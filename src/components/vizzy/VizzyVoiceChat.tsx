import { useEffect, useRef } from "react";
import { X, Mic, Loader2 } from "lucide-react";
import { useVizzyVoice, TranscriptEntry } from "@/hooks/useVizzyVoice";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getUserPrimaryAgent } from "@/lib/userAgentMap";
import assistantHelper from "@/assets/helpers/assistant-helper.png";
import { motion, AnimatePresence } from "framer-motion";

interface VizzyVoiceChatProps {
  onClose: () => void;
}

export function VizzyVoiceChat({ onClose }: VizzyVoiceChatProps) {
  const { voiceState, transcripts, isSpeaking, startSession, endSession } = useVizzyVoice();
  const { user } = useAuth();
  const agent = getUserPrimaryAgent(user?.email);
  const avatarImg = agent?.image || assistantHelper;
  const agentName = agent?.name || "Vizzy";
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-start on mount
  useEffect(() => {
    startSession();
    return () => {
      endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll transcripts
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  const handleClose = () => {
    endSession();
    onClose();
  };

  const statusLabel =
    voiceState === "connecting"
      ? "Connecting to " + agentName + "..."
      : voiceState === "error"
      ? "Connection failed"
      : isSpeaking
      ? agentName + " is speaking..."
      : voiceState === "connected"
      ? "Listening..."
      : "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-background/95 backdrop-blur-xl"
    >
      {/* Close button */}
      <div className="w-full flex justify-end p-4">
        <button
          onClick={handleClose}
          className="p-2 rounded-full bg-muted hover:bg-accent transition-colors"
          aria-label="End voice chat"
        >
          <X className="w-6 h-6 text-foreground" />
        </button>
      </div>

      {/* Center orb + avatar */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          {/* Pulsing rings */}
          <div
            className={cn(
              "absolute inset-0 rounded-full transition-all duration-700",
              voiceState === "connecting" && "animate-ping bg-teal-400/20",
              voiceState === "connected" && !isSpeaking && "animate-pulse bg-teal-400/15",
              isSpeaking && "animate-pulse bg-teal-400/30"
            )}
            style={{ margin: "-20px", borderRadius: "50%" }}
          />
          <div
            className={cn(
              "absolute rounded-full border-2 transition-all duration-500",
              voiceState === "connected" && !isSpeaking && "border-teal-400/40 animate-pulse",
              isSpeaking && "border-teal-400/70 animate-pulse",
              voiceState === "connecting" && "border-teal-400/20 animate-spin",
              voiceState === "error" && "border-destructive/50",
              voiceState === "idle" && "border-muted"
            )}
            style={{ inset: "-24px", borderRadius: "50%" }}
          />

          {/* Avatar */}
          <div
            className={cn(
              "w-28 h-28 rounded-full overflow-hidden ring-4 transition-all duration-500 shadow-2xl",
              voiceState === "connected" && !isSpeaking && "ring-teal-400/60 shadow-teal-500/20",
              isSpeaking && "ring-teal-400 shadow-teal-500/40 scale-105",
              voiceState === "connecting" && "ring-teal-400/30",
              voiceState === "error" && "ring-destructive/50",
              voiceState === "idle" && "ring-muted"
            )}
          >
            <img
              src={avatarImg}
              alt={agentName}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>

          {/* Connecting spinner overlay */}
          {voiceState === "connecting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full">
              <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Status */}
        <p className={cn(
          "text-sm font-medium transition-colors",
          voiceState === "error" ? "text-destructive" : "text-muted-foreground"
        )}>
          {statusLabel}
        </p>

        {/* Retry on error */}
        {voiceState === "error" && (
          <button
            onClick={startSession}
            className="px-4 py-2 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>

      {/* Transcript area */}
      <div className="w-full max-w-md px-4 pb-4 max-h-[35vh] overflow-y-auto">
        <AnimatePresence>
          {transcripts.slice(-6).map((t: TranscriptEntry) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "mb-2 px-3 py-2 rounded-xl text-sm max-w-[85%]",
                t.role === "user"
                  ? "ml-auto bg-teal-500/20 text-foreground"
                  : "mr-auto bg-muted text-foreground"
              )}
            >
              <span className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                {t.role === "user" ? "You" : agentName}
              </span>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* End call button */}
      <div className="pb-8">
        <button
          onClick={handleClose}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-destructive text-destructive-foreground font-medium shadow-lg hover:bg-destructive/90 transition-colors"
        >
          <Mic className="w-5 h-5" />
          End Call
        </button>
      </div>
    </motion.div>
  );
}
