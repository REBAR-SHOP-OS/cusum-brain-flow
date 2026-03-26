import { Button } from "@/components/ui/button";
import { Aperture, X } from "lucide-react";

interface CameraLoaderProps {
  statusText: string;
  progressValue: number;
  onCancel: () => void;
}

export function CameraLoader({ statusText, progressValue, onCancel }: CameraLoaderProps) {
  return (
    <div className="w-full max-w-lg animate-in fade-in duration-300">
      <div className="relative aspect-video rounded-2xl overflow-hidden bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl">
        
        {/* Film grain overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none z-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Corner brackets — top-left */}
        <div className="absolute top-4 left-4 w-8 h-8 z-20">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-white/60" />
          <div className="absolute top-0 left-0 h-full w-[2px] bg-white/60" />
        </div>
        {/* Corner brackets — top-right */}
        <div className="absolute top-4 right-4 w-8 h-8 z-20">
          <div className="absolute top-0 right-0 w-full h-[2px] bg-white/60" />
          <div className="absolute top-0 right-0 h-full w-[2px] bg-white/60" />
        </div>
        {/* Corner brackets — bottom-left */}
        <div className="absolute bottom-14 left-4 w-8 h-8 z-20">
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/60" />
          <div className="absolute bottom-0 left-0 h-full w-[2px] bg-white/60" />
        </div>
        {/* Corner brackets — bottom-right */}
        <div className="absolute bottom-14 right-4 w-8 h-8 z-20">
          <div className="absolute bottom-0 right-0 w-full h-[2px] bg-white/60" />
          <div className="absolute bottom-0 right-0 h-full w-[2px] bg-white/60" />
        </div>

        {/* REC indicator */}
        <div className="absolute top-5 right-14 flex items-center gap-1.5 z-20">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-mono font-bold text-red-400 tracking-wider">REC</span>
        </div>

        {/* Timecode top-left */}
        <div className="absolute top-5 left-14 z-20">
          <span className="text-[10px] font-mono text-white/40 tracking-wider">
            00:{String(Math.floor(progressValue / 100 * 60)).padStart(2, '0')}:{String(Math.floor(Math.random() * 30)).padStart(2, '0')}
          </span>
        </div>

        {/* Scanning line */}
        <div 
          className="absolute left-0 right-0 h-[1px] z-20 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.6) 20%, hsl(var(--primary) / 0.8) 50%, hsl(var(--primary) / 0.6) 80%, transparent 100%)',
            boxShadow: '0 0 12px 2px hsl(var(--primary) / 0.3)',
            animation: 'camera-scan 2.5s ease-in-out infinite',
          }}
        />

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-4">
          {/* Rotating aperture */}
          <div className="relative">
            <Aperture 
              className="w-12 h-12 text-white/30"
              style={{ animation: 'camera-aperture-spin 4s linear infinite' }}
            />
            <div 
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)',
              }}
            />
          </div>

          {/* Status text */}
          <p className="text-sm font-mono text-white/70 tracking-wide">{statusText}</p>
        </div>

        {/* Bottom bar — progress + controls */}
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-black/50 backdrop-blur-sm border-t border-white/10 z-20 flex items-center px-4 gap-3">
          {/* Progress bar */}
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progressValue}%`,
                background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))',
                boxShadow: '0 0 8px hsl(var(--primary) / 0.5)',
              }}
            />
          </div>
          {/* Percentage */}
          <span className="text-[10px] font-mono text-white/50 w-8 text-right">{progressValue}%</span>
          {/* Cancel */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-6 w-6 text-white/40 hover:text-red-400 hover:bg-white/5"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* CSS animations */}
        <style>{`
          @keyframes camera-scan {
            0%, 100% { top: 10%; }
            50% { top: 85%; }
          }
          @keyframes camera-aperture-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
