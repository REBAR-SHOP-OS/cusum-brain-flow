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
      <div className="relative flex items-center justify-center">
        <div
          className="absolute w-32 h-32 rounded-full border-2 border-primary/60"
          style={{ animation: "camera-pulse-outer 2.5s ease-in-out infinite" }}
        />
        <div
          className="absolute w-24 h-24 rounded-full border-[3px] border-primary/80"
          style={{ animation: "camera-pulse-inner 2s ease-in-out infinite" }}
        />
        <div
          className="absolute w-24 h-24 rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, transparent 70%)",
            boxShadow: "0 0 40px 10px hsl(var(--primary) / 0.3)",
            animation: "camera-glow 2s ease-in-out infinite",
          }}
        />
        <Video
          className="w-16 h-16 text-primary"
          strokeWidth={2}
          style={{
            animation: "camera-spin 3s linear infinite",
            filter: "drop-shadow(0 0 12px hsl(var(--primary)))",
          }}
        />

        {sceneCount != null && sceneCount > 0 && (
          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full shadow-lg min-w-[24px] text-center">
            {sceneCount}
          </div>
        )}
      </div>

      {sceneCount != null && sceneCount > 0 && (
        <span className="text-sm font-medium text-white/80 tracking-wide">
          🎬 {sceneCount} Scene{sceneCount > 1 ? "s" : ""}
        </span>
      )}

      <p className="text-base font-semibold font-mono text-white/90 tracking-wide">{statusText}</p>

      <div className="w-48 h-2 rounded-full bg-white/20 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progressValue}%`,
            background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))",
            boxShadow: "0 0 16px hsl(var(--primary) / 0.7)",
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-mono font-semibold text-white/70">{progressValue}%</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-6 w-6 text-white/50 hover:text-red-400 hover:bg-white/5"
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
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes camera-pulse-inner {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 1; }
        }
        @keyframes camera-glow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
