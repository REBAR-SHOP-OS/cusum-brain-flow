import { useEffect, RefObject } from "react";
import { cn } from "@/lib/utils";
import { Camera } from "lucide-react";

interface FaceCameraProps {
  videoRef: RefObject<HTMLVideoElement>;
  isActive: boolean;
  scanning?: boolean;
  className?: string;
}

export function FaceCamera({ videoRef, isActive, scanning, className }: FaceCameraProps) {
  useEffect(() => {
    if (videoRef.current && isActive) {
      videoRef.current.play().catch(() => {});
    }
  }, [videoRef, isActive]);

  if (!isActive) {
    return (
      <div className={cn("flex flex-col items-center justify-center rounded-2xl bg-muted/50 border border-border aspect-[4/3]", className)}>
        <Camera className="w-12 h-12 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">Camera inactive</p>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-2xl overflow-hidden bg-black aspect-[4/3]", className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      {/* Circular face guide overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={cn(
            "w-56 h-56 rounded-full border-4 border-dashed transition-colors duration-500",
            scanning
              ? "border-primary animate-pulse"
              : "border-white/40"
          )}
        />
      </div>
      {scanning && (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <span className="text-xs font-semibold tracking-wider uppercase text-primary bg-black/60 px-3 py-1 rounded-full">
            Scanning...
          </span>
        </div>
      )}
    </div>
  );
}
