import { useEffect, useRef, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface NilaVoiceOrbProps {
  isConnected: boolean;
  isConnecting: boolean;
  onToggle: () => void;
}

const NUM_BARS = 40;
const BASE_RADIUS = 46;
const MAX_BAR_HEIGHT = 28;
const MIN_BAR_HEIGHT = 3;

export function NilaVoiceOrb({ isConnected, isConnecting, onToggle }: NilaVoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const smoothedRef = useRef<Float32Array>(new Float32Array(NUM_BARS));

  const cleanup = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    smoothedRef.current.fill(0);
  }, []);

  useEffect(() => {
    if (!isConnected) {
      cleanup();
      drawIdle();
      return;
    }

    let mounted = true;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          if (!mounted) return;
          animFrameRef.current = requestAnimationFrame(draw);
          analyser.getByteFrequencyData(dataArray);
          drawBars(dataArray, bufferLength);
        };
        draw();
      } catch {
        // Mic access might fail, gracefully degrade
      }
    };

    setup();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [isConnected, cleanup]);

  const drawIdle = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < NUM_BARS; i++) {
      const angle = (i / NUM_BARS) * Math.PI * 2 - Math.PI / 2;
      const barH = MIN_BAR_HEIGHT * dpr;
      const x1 = cx + Math.cos(angle) * BASE_RADIUS * dpr;
      const y1 = cy + Math.sin(angle) * BASE_RADIUS * dpr;
      const x2 = cx + Math.cos(angle) * (BASE_RADIUS * dpr + barH);
      const y2 = cy + Math.sin(angle) * (BASE_RADIUS * dpr + barH);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = "hsla(245, 58%, 55%, 0.3)";
      ctx.lineWidth = 2.5 * dpr;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  };

  const drawBars = (dataArray: Uint8Array, bufferLength: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < NUM_BARS; i++) {
      const dataIndex = Math.floor((i / NUM_BARS) * bufferLength);
      const value = dataArray[dataIndex] / 255;

      const target = MIN_BAR_HEIGHT + value * MAX_BAR_HEIGHT;
      smoothedRef.current[i] += (target - smoothedRef.current[i]) * 0.25;
      const barH = smoothedRef.current[i] * dpr;

      const angle = (i / NUM_BARS) * Math.PI * 2 - Math.PI / 2;
      const innerR = BASE_RADIUS * dpr;
      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * (innerR + barH);
      const y2 = cy + Math.sin(angle) * (innerR + barH);

      const hue = 245 + value * 20;
      const lightness = 50 + value * 15;
      const alpha = 0.5 + value * 0.5;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `hsla(${hue}, 90%, ${lightness}%, ${alpha})`;
      ctx.lineWidth = 3 * dpr;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssSize = 160;
    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;
    drawIdle();
  }, []);

  return (
    <div className="relative flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="absolute pointer-events-none"
      />

      {isConnected && (
        <>
          <motion.div
            className="absolute w-24 h-24 rounded-full border-2 border-indigo-400/20"
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-28 h-28 rounded-full border border-indigo-400/10"
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          />
        </>
      )}

      <motion.button
        onClick={onToggle}
        disabled={isConnecting}
        whileTap={{ scale: 0.92 }}
        className={cn(
          "relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none",
          isConnected
            ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_0_30px_rgba(99,102,241,0.5)]"
            : "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-105",
          isConnecting && "opacity-60 cursor-wait animate-pulse"
        )}
      >
        {isConnected ? (
          <MicOff className="w-7 h-7" />
        ) : (
          <Mic className="w-7 h-7" />
        )}
      </motion.button>
    </div>
  );
}
