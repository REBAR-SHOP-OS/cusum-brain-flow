import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface LanguageMicButtonProps {
  lang: "en" | "fa";
  label: string;
  isActive: boolean;
  isConnecting: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export function LanguageMicButton({
  lang,
  label,
  isActive,
  isConnecting,
  disabled,
  onToggle,
}: LanguageMicButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "relative flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-all min-w-[72px]",
        "focus:outline-none",
        isActive
          ? "bg-primary/15 ring-2 ring-primary/60 shadow-lg"
          : "bg-muted/50 hover:bg-muted ring-1 ring-border",
        disabled && !isActive && "opacity-40 cursor-not-allowed"
      )}
      aria-label={`Record ${lang === "en" ? "English" : "Farsi"}`}
    >
      {/* Pulse rings when active */}
      {isActive && (
        <>
          <motion.div
            className="absolute inset-[-4px] rounded-2xl border border-primary/30"
            animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-[-8px] rounded-2xl border border-primary/20"
            animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.05, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          />
        </>
      )}

      {/* Language label */}
      <span
        className={cn(
          "text-xs font-bold tracking-wide",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
      >
        {label}
      </span>

      {/* Mic icon */}
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isConnecting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isActive ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </div>
    </button>
  );
}
