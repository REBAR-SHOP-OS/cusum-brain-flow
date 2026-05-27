import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, Zap, ZapOff } from "lucide-react";

interface AutoCameraStreamProps {
  onCapture: (blob: Blob) => void;
  ringColor: "blue" | "amber" | "green" | "red" | "none";
  overlayLabel: string;
  disabled?: boolean;
  flashSupported?: (supported: boolean) => void;
}

export interface AutoCameraHandle {
  toggleTorch: () => Promise<void>;
}

/**
 * Persistent <video> stream using getUserMedia. Lives across the whole
 * Auto Clearance session — never reopens between captures.
 */
export function AutoCameraStream({
  onCapture,
  ringColor,
  overlayLabel,
  disabled,
}: AutoCameraStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [capturing, setCapturing] = useState(false);

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

          {/* Shutter + torch */}
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
            <button
              type="button"
              onClick={handleShutter}
              disabled={disabled || capturing}
              className="w-24 h-24 rounded-full bg-white/95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
              aria-label="Capture photo"
            >
              <div className="w-20 h-20 rounded-full border-4 border-black/80" />
            </button>
            <div className="w-14 h-14" />
          </div>
        </>
      )}
    </div>
  );
}
