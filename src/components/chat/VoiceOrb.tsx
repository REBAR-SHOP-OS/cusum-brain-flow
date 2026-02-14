import { motion } from "framer-motion";
import { Square } from "lucide-react";
import type { VoiceChatStatus } from "@/hooks/useVoiceChat";

interface VoiceOrbProps {
  status: VoiceChatStatus;
  onTap: () => void;
  disabled?: boolean;
}

const barHeights = {
  idle: [12, 20, 16, 24, 14],
  listening: [8, 28, 12, 32, 10],
  thinking: [14, 14, 14, 14, 14],
  speaking: [10, 26, 18, 30, 12],
};

const statusLabels: Record<VoiceChatStatus, string> = {
  idle: "Tap to start conversation",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking… tap to interrupt",
};

export function VoiceOrb({ status, onTap, disabled }: VoiceOrbProps) {
  const isActive = status === "listening" || status === "speaking";
  const isThinking = status === "thinking";
  const isConversationActive = status !== "idle";

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        type="button"
        onClick={onTap}
        disabled={disabled}
        className="relative w-16 h-16 rounded-full bg-foreground/90 flex items-center justify-center gap-[3px] transition-shadow hover:shadow-lg disabled:opacity-50 focus:outline-none"
        whileTap={{ scale: 0.92 }}
        animate={isActive ? { scale: [1, 1.04, 1] } : {}}
        transition={isActive ? { repeat: Infinity, duration: 1.2, ease: "easeInOut" } : {}}
      >
        {/* Outer pulse ring */}
        {isActive && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-foreground/40"
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
          />
        )}

        {/* Show stop icon when listening (tap to end), sound bars otherwise */}
        {status === "listening" ? (
          <Square className="w-5 h-5 text-background" />
        ) : (
          barHeights[status].map((h, i) => (
            <motion.span
              key={i}
              className="w-[3px] rounded-full bg-background"
              initial={{ height: 12 }}
              animate={
                isActive
                  ? { height: [h * 0.4, h, h * 0.5, h * 0.9, h * 0.4] }
                  : isThinking
                    ? { height: [10, 18, 10], opacity: [0.5, 1, 0.5] }
                    : { height: h }
              }
              transition={
                isActive
                  ? { repeat: Infinity, duration: 0.8 + i * 0.1, ease: "easeInOut" }
                  : isThinking
                    ? { repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: i * 0.15 }
                    : { duration: 0.3 }
              }
            />
          ))
        )}
      </motion.button>
      <span className="text-xs text-muted-foreground">{statusLabels[status]}</span>
    </div>
  );
}
