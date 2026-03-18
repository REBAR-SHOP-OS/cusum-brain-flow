import { useEffect, useRef, useState } from "react";
import { X, Mic, Loader2, Volume2 } from "lucide-react";
import { useVizzyVoiceEngine, VizzyVoiceTranscript } from "@/hooks/useVizzyVoiceEngine";
import { cn } from "@/lib/utils";
import vizzyAvatar from "@/assets/vizzy-avatar.png";
import { motion, AnimatePresence } from "framer-motion";

interface VizzyVoiceChatProps {
  onClose: () => void;
}

export function VizzyVoiceChat({ onClose }: VizzyVoiceChatProps) {
  const {
    state: voiceState, transcripts, isSpeaking, mode,
    startSession, endSession, contextLoading,
  } = useVizzyVoiceEngine();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [connectingElapsed, setConnectingElapsed] = useState(0);

  // Auto-start on mount
  useEffect(() => {
    startSession();
    return () => { endSession(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll transcripts
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Connecting elapsed timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (voiceState === "connecting") {
      setConnectingElapsed(0);
      interval = setInterval(() => setConnectingElapsed((e) => e + 1), 1000);
    } else {
      setConnectingElapsed(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [voiceState]);

  const handleClose = () => {
    endSession();
    onClose();
  };

  const statusLabel =
    voiceState === "connecting"
      ? connectingElapsed >= 10
        ? "Taking longer than expected..."
        : "Connecting to Vizzy..."
      : voiceState === "error"
      ? "Connection failed"
      : mode === "speaking" || isSpeaking
      ? agentName + " is speaking..."
      : voiceState === "connected"
      ? "Listening..."
      : "";

  // Audio-reactive orb styles
  const isActive = mode === "speaking" || isSpeaking;
  const orbScale = isActive ? 1.15 : 1;
  const glowIntensity = isActive ? 0.6 : 0;

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
          {/* Outer glow */}
          <div
            className="absolute rounded-full transition-all duration-300"
            style={{
              inset: "-32px",
              borderRadius: "50%",
              background: `radial-gradient(circle, hsl(var(--primary) / ${0.05 + glowIntensity * 0.25}) 0%, transparent 70%)`,
              transform: `scale(${1 + glowIntensity * 0.4})`,
            }}
          />

          {/* Ring */}
          <div
            className="absolute rounded-full border-2 transition-all duration-300"
            style={{
              inset: "-24px",
              borderRadius: "50%",
              borderColor: `hsl(172 66% 50% / ${0.3 + glowIntensity * 0.5})`,
              transform: `scale(${1 + glowIntensity * 0.15})`,
            }}
          />

          {/* Connecting pulse */}
          {voiceState === "connecting" && (
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{ margin: "-20px", borderRadius: "50%", background: "hsl(172 66% 50% / 0.15)" }}
            />
          )}

          {/* Avatar */}
          <div
            className={cn(
              "w-28 h-28 rounded-full overflow-hidden shadow-2xl transition-all duration-200",
              voiceState === "connected" ? "ring-4 ring-primary/60" :
              voiceState === "connecting" ? "ring-4 ring-primary/30" :
              voiceState === "error" ? "ring-4 ring-destructive/50" : "ring-4 ring-muted"
            )}
            style={{
              transform: `scale(${voiceState === "connected" ? orbScale : 1})`,
              boxShadow: voiceState === "connected" && isActive
                ? `0 0 60px 15px hsl(172 66% 50% / 0.4)`
                : voiceState === "error"
                ? "0 0 20px 5px hsl(var(--destructive) / 0.3)"
                : "none",
            }}
          >
            <img
              src={avatarImg}
              alt={agentName}
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>

          {/* Connecting spinner */}
          {voiceState === "connecting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
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

        {/* Retry / Cancel */}
        {voiceState === "error" && (
          <button
            onClick={startSession}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        )}
        {voiceState === "connecting" && connectingElapsed >= 10 && (
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Transcript area */}
      <div className="w-full max-w-md px-4 pb-2 max-h-[30vh] overflow-y-auto">
        <AnimatePresence>
          {transcripts.slice(-6).map((t: VizzyVoiceTranscript) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "mb-2 px-3 py-2 rounded-xl text-sm max-w-[85%]",
                t.role === "user"
                  ? "ml-auto bg-primary/15 text-foreground"
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

      {/* End call */}
      <div className="pb-8 flex flex-col items-center gap-4">
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
