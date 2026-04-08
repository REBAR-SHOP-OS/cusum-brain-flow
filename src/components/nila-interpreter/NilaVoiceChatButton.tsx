import { motion } from "framer-motion";
import nilaAvatar from "@/assets/helpers/nila-helper.png";

interface NilaVoiceChatButtonProps {
  onClick: () => void;
}

export function NilaVoiceChatButton({ onClick }: NilaVoiceChatButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative w-12 h-12 rounded-full focus:outline-none group"
      aria-label="Start voice chat with Nila"
    >
      {/* Outer animated rings */}
      <motion.div
        className="absolute inset-[-6px] rounded-full border border-primary/30"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.15, 0.4] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-[-12px] rounded-full border border-primary/20"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />
      <motion.div
        className="absolute inset-[-18px] rounded-full border border-primary/10"
        animate={{ scale: [1, 1.25, 1], opacity: [0.2, 0.05, 0.2] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />

      {/* Avatar */}
      <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-primary/50 group-hover:ring-primary transition-all shadow-lg">
        <img src={nilaAvatar} alt="Nila" className="w-full h-full object-cover" draggable={false} />
      </div>
    </button>
  );
}
