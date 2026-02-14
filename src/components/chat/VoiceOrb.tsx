import { motion } from "framer-motion";
import { Mic, Loader2, Volume2 } from "lucide-react";
import type { VoiceChatStatus } from "@/hooks/useVoiceChat";

interface VoiceOrbProps {
  status: VoiceChatStatus;
  onTap: () => void;
  disabled?: boolean;
}

const statusConfig = {
  idle: {
    ringColor: "ring-teal-400",
    bgColor: "bg-card",
    icon: Mic,
    iconColor: "text-teal-400",
    pulse: false,
    spin: false,
    label: "Tap to speak",
  },
  listening: {
    ringColor: "ring-destructive",
    bgColor: "bg-card",
    icon: Mic,
    iconColor: "text-destructive",
    pulse: true,
    spin: false,
    label: "Listening… tap to send",
  },
  thinking: {
    ringColor: "ring-primary",
    bgColor: "bg-card",
    icon: Loader2,
    iconColor: "text-primary",
    pulse: false,
    spin: true,
    label: "Thinking…",
  },
  speaking: {
    ringColor: "ring-teal-400",
    bgColor: "bg-card",
    icon: Volume2,
    iconColor: "text-teal-400",
    pulse: true,
    spin: false,
    label: "Speaking… tap to interrupt",
  },
};

export function VoiceOrb({ status, onTap, disabled }: VoiceOrbProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        type="button"
        onClick={onTap}
        disabled={disabled}
        className={`relative w-16 h-16 rounded-full ${config.bgColor} ring-2 ${config.ringColor} flex items-center justify-center transition-shadow hover:shadow-lg disabled:opacity-50 focus:outline-none`}
        whileTap={{ scale: 0.92 }}
        animate={config.pulse ? { scale: [1, 1.08, 1] } : {}}
        transition={config.pulse ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}}
      >
        {/* Outer pulse ring for listening/speaking */}
        {config.pulse && (
          <motion.span
            className={`absolute inset-0 rounded-full ring-2 ${config.ringColor} opacity-40`}
            animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
          />
        )}
        <Icon
          className={`w-6 h-6 ${config.iconColor} ${config.spin ? "animate-spin" : ""}`}
        />
      </motion.button>
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </div>
  );
}
