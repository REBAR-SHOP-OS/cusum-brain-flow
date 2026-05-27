import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, Zap, ZapOff } from "lucide-react";

/**
 * Crop ROI from the live <video>, upscale, convert to high-contrast grayscale
 * with a light sharpening pass. Produces a JPEG blob optimized for OCR rather
 * than for human viewing — boosts the chance of reading dirty / bent / faded tags.
 */
async function preprocessRoiForOcr(
  video: HTMLVideoElement,
  sx: number, sy: number, sw: number, sh: number,
): Promise<Blob | null> {
  // Upscale so small printed text has more pixels per stroke.
  const target = 1600;
  const scale = Math.max(1, target / Math.max(sw, sh));
  const W = Math.round(sw * scale);
  const H = Math.round(sh * scale);

  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);

  let img: ImageData;
  try { img = ctx.getImageData(0, 0, W, H); } catch { return null; }
  const d = img.data;

  // Pass 1: grayscale + collect luma histogram for contrast stretch
  const gray = new Uint8ClampedArray(W * H);
  let lo = 255, hi = 0;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const y = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
    gray[p] = y;
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  // Robust stretch (ignore extreme 2% so specular highlights don't kill contrast)
  const range = Math.max(20, hi - lo);
  const black = Math.min(255, lo + range * 0.02);
  const white = Math.max(0, hi - range * 0.02);
  const span = Math.max(1, white - black);

  // Pass 2: contrast stretch
  const stretched = new Uint8ClampedArray(W * H);
  for (let p = 0; p < gray.length; p++) {
    const v = ((gray[p] - black) * 255) / span;
    stretched[p] = v < 0 ? 0 : v > 255 ? 255 : v;
  }

  // Pass 3: light unsharp mask (sharpen) — center+, neighbors-
  const out = new Uint8ClampedArray(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const v =
        5 * stretched[i]
        - stretched[i - 1] - stretched[i + 1]
        - stretched[i - W] - stretched[i + W];
      out[i] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  // Copy borders unchanged
  for (let x = 0; x < W; x++) { out[x] = stretched[x]; out[(H - 1) * W + x] = stretched[(H - 1) * W + x]; }
  for (let y = 0; y < H; y++) { out[y * W] = stretched[y * W]; out[y * W + W - 1] = stretched[y * W + W - 1]; }

  // Write back as grayscale RGBA
  for (let p = 0, i = 0; p < out.length; p++, i += 4) {
    const v = out[p];
    d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return await new Promise<Blob | null>((res) =>
    c.toBlob((b) => res(b), "image/jpeg", 0.92)
  );
}

export type CoachHint =
  | "scanning"
  | "move_to_tag"
  | "hold_steady"
  | "too_dark"
  | "turn_on_flashlight"
  | "align_in_frame"
  | "ready";

interface AutoCameraStreamProps {
  /** "tag" = guided ROI capture with auto-trigger; "product" = full-frame manual shutter */
  mode: "tag" | "product";
  /** Receives the FINAL image to send to OCR/validation.
   *  In tag mode this is the cropped ROI; in product mode this is the full frame. */
  onCapture: (blob: Blob) => void;
  ringColor: "blue" | "amber" | "green" | "red" | "none";
  overlayLabel: string;
  disabled?: boolean;
  /** Live coaching hint for the tag-detection loop */
  onCoach?: (hint: CoachHint) => void;
}

/**
 * Persistent <video> stream using getUserMedia. Lives across the whole
 * Auto Clearance session — never reopens between captures.
 *
 * In "tag" mode it renders a scan frame and runs a per-frame quality loop
 * (brightness / blur proxy / edge-density). When the ROI is stable & readable
 * for ≥500ms it auto-captures the CROPPED ROI and hands it to onCapture.
 * The full-frame OCR path is intentionally avoided.
 */
export function AutoCameraStream({
  mode,
  onCapture,
  ringColor,
  overlayLabel,
  disabled,
  onCoach,
}: AutoCameraStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [hint, setHint] = useState<CoachHint>("scanning");

  // ROI box (relative to displayed video container), tag = portrait-ish band
  // Tag boxes are typically tall narrow rectangles; centered, 70% w, 55% h.
  const ROI = { x: 0.15, y: 0.22, w: 0.70, h: 0.56 };

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera API not available");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const track = stream.getVideoTracks()[0];
        const caps: any = track.getCapabilities?.() || {};
        setTorchSupported(!!caps.torch);
      } catch (e: any) {
        console.error("getUserMedia failed", e);
        setError(e?.message || "Could not access camera");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] as any });
      setTorchOn(!torchOn);
    } catch (e) {
      console.warn("Torch toggle failed", e);
    }
  };

  // ============== Frame-quality loop (TAG MODE ONLY) ==============
  //
  // Pulls ~6fps low-res samples of the ROI, computes:
  //   brightness  — mean luma
  //   sharpness   — variance of Sobel-edge magnitudes (blur proxy)
  //   edgeDensity — % of strong-edge pixels (text-density proxy)
  // Auto-captures the cropped ROI once all three pass for 500ms.
  useEffect(() => {
    if (mode !== "tag") return;
    if (error) return;

    const video = videoRef.current;
    if (!video) return;

    let raf = 0;
    let stableSince = 0;
    let lastSample = 0;
    let cancelled = false;
    const sample = document.createElement("canvas");
    sample.width = 160;
    sample.height = 120;
    const sctx = sample.getContext("2d", { willReadFrequently: true });

    const setHintBoth = (h: CoachHint) => {
      setHint((cur) => (cur === h ? cur : h));
      onCoach?.(h);
    };

    const loop = (ts: number) => {
      if (cancelled) return;
      raf = requestAnimationFrame(loop);
      if (disabled || capturing) return;
      if (!video.videoWidth || !sctx) return;
      if (ts - lastSample < 160) return; // ~6fps
      lastSample = ts;

      // Crop ROI from video into sample canvas
      const sx = video.videoWidth * ROI.x;
      const sy = video.videoHeight * ROI.y;
      const sw = video.videoWidth * ROI.w;
      const sh = video.videoHeight * ROI.h;
      try {
        sctx.drawImage(video, sx, sy, sw, sh, 0, 0, sample.width, sample.height);
      } catch {
        return;
      }
      const img = sctx.getImageData(0, 0, sample.width, sample.height);
      const d = img.data;
      const W = sample.width;
      const H = sample.height;

      // Pass 1: luma + grayscale buffer
      const gray = new Uint8ClampedArray(W * H);
      let sumLuma = 0;
      for (let i = 0, p = 0; i < d.length; i += 4, p++) {
        const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        gray[p] = y;
        sumLuma += y;
      }
      const meanLuma = sumLuma / (W * H);

      // Pass 2: Sobel magnitude across interior pixels
      let edgeSum = 0;
      let edgeSqSum = 0;
      let strongEdges = 0;
      let n = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          const gx =
            -gray[i - W - 1] - 2 * gray[i - 1] - gray[i + W - 1] +
             gray[i - W + 1] + 2 * gray[i + 1] + gray[i + W + 1];
          const gy =
            -gray[i - W - 1] - 2 * gray[i - W] - gray[i - W + 1] +
             gray[i + W - 1] + 2 * gray[i + W] + gray[i + W + 1];
          const m = Math.abs(gx) + Math.abs(gy);
          edgeSum += m;
          edgeSqSum += m * m;
          if (m > 90) strongEdges++;
          n++;
        }
      }
      const meanEdge = edgeSum / n;
      const sharpness = edgeSqSum / n - meanEdge * meanEdge; // edge-magnitude variance
      const edgeDensity = strongEdges / n;

      // Decision thresholds (empirical for printed rebar tags on phone cams)
      const tooDark = meanLuma < 55;
      const tooBlurry = sharpness < 600;
      const lowText = edgeDensity < 0.04; // <4% strong edges → likely no tag in frame

      if (tooDark) {
        setHintBoth(torchSupported && !torchOn ? "turn_on_flashlight" : "too_dark");
        stableSince = 0;
        return;
      }
      if (lowText) {
        setHintBoth("move_to_tag");
        stableSince = 0;
        return;
      }
      if (tooBlurry) {
        setHintBoth("hold_steady");
        stableSince = 0;
        return;
      }

      // All checks pass — start / continue stability window
      setHintBoth("ready");
      if (!stableSince) stableSince = ts;
      if (ts - stableSince >= 500) {
        stableSince = 0;
        autoCaptureRoi();
      }
    };

    const autoCaptureRoi = async () => {
      if (capturing || disabled) return;
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      setCapturing(true);
      try {
        const sx = v.videoWidth * ROI.x;
        const sy = v.videoHeight * ROI.y;
        const sw = v.videoWidth * ROI.w;
        const sh = v.videoHeight * ROI.h;
        const blob = await preprocessRoiForOcr(v, sx, sy, sw, sh);
        if (blob) onCapture(blob);
      } catch (e) {
        console.error("ROI capture failed", e);
      } finally {
        setTimeout(() => setCapturing(false), 250);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [mode, disabled, capturing, error, torchOn, torchSupported, onCapture, onCoach]);

  // Manual shutter — used by PRODUCT mode (full frame).
  const handleShutter = async () => {
    if (disabled || capturing) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas ctx unavailable");
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
      );
      if (blob) onCapture(blob);
    } catch (e) {
      console.error("capture failed", e);
    } finally {
      setTimeout(() => setCapturing(false), 150);
    }
  };

  const ringClass = {
    blue: "ring-4 ring-sky-400/80 shadow-[0_0_40px_rgba(56,189,248,0.45)]",
    amber: "ring-4 ring-amber-400/80 shadow-[0_0_40px_rgba(251,191,36,0.45)]",
    green: "ring-4 ring-emerald-400/80 shadow-[0_0_40px_rgba(52,211,153,0.45)]",
    red: "ring-4 ring-red-500/80 shadow-[0_0_40px_rgba(239,68,68,0.45)]",
    none: "",
  }[ringColor];

  const hintText: Record<CoachHint, string> = {
    scanning: "Point the tag inside the frame",
    move_to_tag: "Move camera to the tag",
    hold_steady: "Hold steady…",
    too_dark: "Too dark — add light",
    turn_on_flashlight: "Turn on flashlight",
    align_in_frame: "Align tag inside the frame",
    ready: "Reading…",
  };

  const frameColor =
    hint === "ready" ? "border-emerald-400"
    : hint === "hold_steady" ? "border-amber-300"
    : hint === "too_dark" || hint === "turn_on_flashlight" ? "border-amber-400"
    : "border-white/80";

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-white">
          <CameraIcon className="w-16 h-16 mb-3 opacity-50" />
          <p className="text-sm">{error}</p>
          <p className="text-xs mt-2 opacity-70">
            Allow camera access in your browser to use Auto Clearance.
          </p>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`w-full h-full object-cover transition-shadow duration-200 ${ringClass}`}
          />

          {/* Status pill */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 backdrop-blur text-white text-xs font-bold tracking-[0.18em] uppercase">
            {overlayLabel}
          </div>

          {/* TAG SCAN FRAME (tag mode only) */}
          {mode === "tag" && (
            <>
              {/* Dim outside ROI via four black overlays */}
              <div className="absolute inset-x-0 top-0 bg-black/55 pointer-events-none"
                style={{ height: `${ROI.y * 100}%` }} />
              <div className="absolute inset-x-0 bottom-0 bg-black/55 pointer-events-none"
                style={{ height: `${(1 - ROI.y - ROI.h) * 100}%` }} />
              <div className="absolute left-0 bg-black/55 pointer-events-none"
                style={{ top: `${ROI.y * 100}%`, height: `${ROI.h * 100}%`, width: `${ROI.x * 100}%` }} />
              <div className="absolute right-0 bg-black/55 pointer-events-none"
                style={{ top: `${ROI.y * 100}%`, height: `${ROI.h * 100}%`, width: `${(1 - ROI.x - ROI.w) * 100}%` }} />

              {/* Frame */}
              <div
                className={`absolute border-2 rounded-2xl pointer-events-none transition-colors duration-150 ${frameColor}`}
                style={{
                  left: `${ROI.x * 100}%`,
                  top: `${ROI.y * 100}%`,
                  width: `${ROI.w * 100}%`,
                  height: `${ROI.h * 100}%`,
                  boxShadow: hint === "ready" ? "0 0 32px rgba(52,211,153,0.55) inset" : undefined,
                }}
              >
                {/* corner brackets */}
                {["top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl",
                  "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl",
                  "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
                  "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl"]
                  .map((c, i) => (
                    <span key={i} className={`absolute w-8 h-8 ${c} ${frameColor}`} />
                  ))}
              </div>

              {/* Coach hint */}
              <div
                className="absolute left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/80 text-white text-xs font-bold tracking-wider uppercase whitespace-nowrap pointer-events-none"
                style={{ top: `calc(${(ROI.y + ROI.h) * 100}% + 12px)` }}
              >
                {hintText[hint]}
              </div>
            </>
          )}

          {/* Bottom controls */}
          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-8 px-6">
            {torchSupported && (
              <button
                type="button"
                onClick={toggleTorch}
                className="w-14 h-14 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white border border-white/20"
                aria-label="Toggle flashlight"
              >
                {torchOn ? <Zap className="w-6 h-6" /> : <ZapOff className="w-6 h-6" />}
              </button>
            )}

            {mode === "product" ? (
              <button
                type="button"
                onClick={handleShutter}
                disabled={disabled || capturing}
                className="w-24 h-24 rounded-full bg-white/95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
                aria-label="Capture product photo"
              >
                <div className="w-20 h-20 rounded-full border-4 border-black/80" />
              </button>
            ) : (
              // Tag mode: auto-capture only. Show passive indicator.
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center border-4 ${
                  hint === "ready" ? "border-emerald-400 bg-emerald-400/20" : "border-white/40 bg-black/40"
                }`}
                aria-hidden
              >
                <div className={`w-3 h-3 rounded-full ${hint === "ready" ? "bg-emerald-400 animate-pulse" : "bg-white/60"}`} />
              </div>
            )}
            <div className="w-14 h-14" />
          </div>
        </>
      )}
    </div>
  );
}
