import { useCallback, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";

const BTN_SIZE = 72;

interface FloatingMicButtonProps {
  onToggleVoice: () => void;
  isListening: boolean;
  isSupported: boolean;
}

export function FloatingMicButton({ onToggleVoice, isListening, isSupported }: FloatingMicButtonProps) {
  const { pos, handlers, wasDragged } = useDraggablePosition({
    storageKey: "feedback-mic-pos",
    btnSize: BTN_SIZE,
    defaultPos: () => ({
      x: typeof window !== "undefined" ? window.innerWidth - BTN_SIZE - 24 : 300,
      y: typeof window !== "undefined" ? window.innerHeight - BTN_SIZE - 96 - 48 : 240,
    }),
  });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation(); // Prevent Radix Dialog from detecting outside click
    handlers.onPointerDown(e);
  }, [handlers]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    handlers.onPointerUp(e);
    if (!wasDragged.current) {
      onToggleVoice();
    }
  }, [handlers, onToggleVoice, wasDragged]);

  if (!isSupported) return null;

  return (
    <button
      data-feedback-btn="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlePointerUp}
      className={`fixed z-[9999] w-[72px] h-[72px] rounded-full shadow-xl ring-2 ring-white/40 flex items-center justify-center hover:scale-110 transition-transform cursor-grab active:cursor-grabbing select-none ${
        isListening
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : "bg-primary text-primary-foreground"
      }`}
      style={{ left: pos.x, top: pos.y, touchAction: "none", pointerEvents: "auto" }}
      aria-label={isListening ? "Stop voice recording" : "Start voice recording"}
      title={isListening ? "Tap to stop recording" : "Tap to start voice feedback"}
    >
      {isListening ? (
        <MicOff className="w-9 h-9 pointer-events-none" />
      ) : (
        <Mic className="w-9 h-9 pointer-events-none" />
      )}
    </button>
  );
}
