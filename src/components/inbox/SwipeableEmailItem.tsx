import { useState, useRef, useCallback } from "react";
import { Trash2, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeableEmailItemProps {
  children: React.ReactNode;
  onDelete: () => void;
  onArchive: () => void;
  disabled?: boolean;
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

export function SwipeableEmailItem({ children, onDelete, onArchive, disabled }: SwipeableEmailItemProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = 0;
    isHorizontal.current = null;
    setIsSwiping(false);
  }, [disabled]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    currentX.current = 0;
    isHorizontal.current = null;

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX.current;
      const dy = ev.clientY - startY.current;

      if (isHorizontal.current === null) {
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          isHorizontal.current = Math.abs(dx) > Math.abs(dy);
        }
        return;
      }

      if (!isHorizontal.current) return;

      setIsSwiping(true);
      const clamped = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, dx));
      currentX.current = clamped;
      setOffsetX(clamped);
    };

    const handleMouseUp = () => {
      handleEnd();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (isHorizontal.current === null) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isHorizontal.current = Math.abs(dx) > Math.abs(dy);
      }
      return;
    }

    if (!isHorizontal.current) return;

    setIsSwiping(true);
    const clamped = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, dx));
    currentX.current = clamped;
    setOffsetX(clamped);
  }, [disabled]);

  const handleEnd = useCallback(() => {
    if (!isSwiping && isHorizontal.current !== true) {
      setOffsetX(0);
      setIsSwiping(false);
      return;
    }

    const x = currentX.current;

    if (x < -SWIPE_THRESHOLD) {
      // Swiped left → Delete
      setDismissed(true);
      setTimeout(onDelete, 300);
    } else if (x > SWIPE_THRESHOLD) {
      // Swiped right → Archive
      setDismissed(true);
      setTimeout(onArchive, 300);
    } else {
      setOffsetX(0);
    }

    setIsSwiping(false);
  }, [isSwiping, onDelete, onArchive]);

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const absOffset = Math.abs(offsetX);
  const progress = Math.min(absOffset / SWIPE_THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden transition-all",
        dismissed && "max-h-0 opacity-0",
        !dismissed && "max-h-[200px]"
      )}
      style={{ transitionDuration: dismissed || !isSwiping ? "300ms" : "0ms" }}
    >
      {/* Left background — Archive (swipe right) */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex items-center px-4 transition-colors",
          progress >= 1 ? "bg-green-500" : "bg-green-500/60"
        )}
        style={{ width: Math.max(offsetX, 0) }}
      >
        <Archive className="w-5 h-5 text-white" style={{ opacity: progress }} />
        {progress >= 0.5 && (
          <span className="text-white text-xs font-medium ml-2" style={{ opacity: progress }}>
            Archive
          </span>
        )}
      </div>

      {/* Right background — Delete (swipe left) */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-end px-4 transition-colors",
          progress >= 1 ? "bg-destructive" : "bg-destructive/60"
        )}
        style={{ width: Math.max(-offsetX, 0) }}
      >
        {progress >= 0.5 && (
          <span className="text-white text-xs font-medium mr-2" style={{ opacity: progress }}>
            Delete
          </span>
        )}
        <Trash2 className="w-5 h-5 text-white" style={{ opacity: progress }} />
      </div>

      {/* Content */}
      <div
        className="relative bg-background"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? "none" : "transform 300ms ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {children}
      </div>
    </div>
  );
}
