import { Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraLoaderProps {
  statusText: string;
  progressValue: number;
  sceneCount?: number;
  onCancel: () => void;
}

export function CameraLoader({ statusText, progressValue, sceneCount, onCancel }: CameraLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
      {/* Spinning camera with pulsing rings */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulsing ring */}
        <div
          className="absolute w-32 h-32 rounded-full border border-primary/30"
          style={{ animation: "camera-pulse-outer 2.5s ease-in-out infinite" }}
        />
        {/* Inner pulsing ring */}
        <div
          className="absolute w-24 h-24 rounded-full border-2 border-primary/50"
          style={{ animation: "camera-pulse-inner 2s ease-in-out infinite" }}
        />
        {/* Glow backdrop */}
        <div
          className="absolute w-20 h-20 rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, transparent 70%)",
            animation: "camera-glow 2s ease-in-out infinite",
          }}
        />
        {/* Camera icon */}
        <Video
          className="w-16 h-16 text-primary drop-shadow-lg"
          strokeWidth={1.5}
          style={{ animation: "camera-spin 3s linear infinite" }}
        />

        {/* Scene count badge */}
        {sceneCount != null && sceneCount > 0 && (
          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full shadow-lg min-w-[24px] text-center">
            {sceneCount}
          </div>
        )}
      </div>

      {/* Scene label */}
      {sceneCount != null && sceneCount > 0 && (
        <span className="text-sm font-medium text-white/80 tracking-wide">
          🎬 {sceneCount} Scene{sceneCount > 1 ? "s" : ""}
        </span>
      )}

      {/* Status text */}
      <p className="text-sm font-mono text-white/60 tracking-wide">{statusText}</p>

      {/* Progress bar */}
      <div className="w-48 h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progressValue}%`,
            background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))",
            boxShadow: "0 0 10px hsl(var(--primary) / 0.5)",
          }}
        />
      </div>

      {/* Percentage + Cancel */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-white/40">{progressValue}%</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-6 w-6 text-white/30 hover:text-red-400 hover:bg-white/5"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <style>{`
        @keyframes camera-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes camera-pulse-outer {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
        @keyframes camera-pulse-inner {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        @keyframes camera-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
