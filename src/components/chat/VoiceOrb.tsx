import { motion } from "framer-motion";
import { Mic, MicOff, Square } from "lucide-react";
import type { VoiceChatStatus } from "@/hooks/useVoiceChat";

interface VoiceOrbProps {
  status: VoiceChatStatus;
  onTap: () => void;
  disabled?: boolean;
  micActive?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
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
  speaking: "Speaking… speak to interrupt",
};

export function VoiceOrb({ status, onTap, disabled, micActive, isMuted, onToggleMute }: VoiceOrbProps) {
  const isActive = status === "listening" || status === "speaking";
  const isThinking = status === "thinking";
  const isConversationActive = status !== "idle";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-4">
        {/* Mute button -- only visible when conversation is active */}
        {isConversationActive && onToggleMute && (
          <motion.button
            type="button"
            onClick={onToggleMute}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isMuted
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }`}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            title={isMuted ? "Unmute mic" : "Mute mic"}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </motion.button>
        )}

        {/* Main orb */}
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

          {/* Mic-active indicator during speaking (barge-in ready) */}
          {status === "speaking" && micActive && !isMuted && (
            <motion.span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
            >
              <Mic className="w-3 h-3 text-destructive-foreground" />
            </motion.span>
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
      </div>
      <span className="text-xs text-muted-foreground">
        {isMuted ? "Muted" : statusLabels[status]}
      </span>
    </div>
  );
}