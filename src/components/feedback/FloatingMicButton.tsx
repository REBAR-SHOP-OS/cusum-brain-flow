import { useCallback, useRef } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { useDraggablePosition } from "@/hooks/useDraggablePosition";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

const BTN_SIZE = 56;

interface FloatingMicButtonProps {
  onRecordingComplete: (transcript: string) => void;
}

export function FloatingMicButton({ onRecordingComplete }: FloatingMicButtonProps) {
  const transcriptRef = useRef("");

  const speech = useSpeechRecognition({
    lang: "fa-IR",
    onError: (err) => toast.error(err),
  });

  const { pos, handlers, wasDragged } = useDraggablePosition({
    storageKey: "feedback-mic-pos",
    btnSize: BTN_SIZE,
    defaultPos: () => ({
      x: typeof window !== "undefined" ? window.innerWidth - BTN_SIZE - 24 : 300,
      y: typeof window !== "undefined" ? window.innerHeight - BTN_SIZE - 96 - 48 : 240,
    }),
  });

  // Keep transcript ref in sync
  transcriptRef.current = speech.fullTranscript;

  const toggleRecording = useCallback(() => {
    if (speech.isListening) {
      speech.stop();
      const text = transcriptRef.current.trim();
      if (text) {
        onRecordingComplete(text);
      }
      speech.reset();
    } else {
      speech.reset();
      speech.start();
    }
  }, [speech.isListening, speech.stop, speech.start, speech.reset, onRecordingComplete]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    handlers.onPointerUp(e);
    if (!wasDragged.current) {
      toggleRecording();
    }
  }, [handlers, toggleRecording, wasDragged]);

  return (
    <button
      data-feedback-btn="true"
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlePointerUp}
      className={`fixed z-[9999] w-14 h-14 rounded-full shadow-lg ring-1 ring-white/30 flex items-center justify-center hover:scale-110 transition-transform cursor-grab active:cursor-grabbing select-none ${
        speech.isListening
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : "bg-primary text-primary-foreground"
      }`}
      style={{ left: pos.x, top: pos.y, touchAction: "none", pointerEvents: "auto" }}
      aria-label={speech.isListening ? "Stop voice recording" : "Start voice recording"}
      title={speech.isListening ? "Tap to stop recording" : "Tap to start voice feedback"}
    >
      {speech.isListening ? (
        <MicOff className="w-7 h-7 pointer-events-none" />
      ) : (
        <Mic className="w-7 h-7 pointer-events-none" />
      )}
    </button>
  );
}

