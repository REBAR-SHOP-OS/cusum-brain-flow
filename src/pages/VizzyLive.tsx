import { useEffect, useRef, useState, useCallback } from "react";
import { X, Mic, MicOff, Loader2, ArrowLeft } from "lucide-react";
import { useVizzyVoiceEngine, VizzyVoiceTranscript } from "@/hooks/useVizzyVoiceEngine";
import { cn } from "@/lib/utils";
import { useNavigate, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import assistantHelper from "@/assets/helpers/assistant-helper.png";

/**
 * /vizzy — Full-screen ChatGPT-Live-style voice UI for Vizzy
 */
export default function VizzyLive() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useSuperAdmin();
  const {
    state, transcripts, isSpeaking, mode,
    startSession, endSession, clearTranscripts,
  } = useVizzyVoiceEngine();

  const bottomRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  // Auto-start session on mount
  useEffect(() => {
    if (!isSuperAdmin) return;
    startSession();
    return () => { endSession(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Connecting timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (state === "connecting") {
      setElapsed(0);
      interval = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      setElapsed(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [state]);

  const handleEnd = useCallback(() => {
    endSession();
    navigate("/home");
  }, [endSession, navigate]);

  // Super admin gate — redirect non-admins
  if (!isSuperAdmin) {
    return <Navigate to="/home" replace />;
  }

  const isActive = mode === "speaking" || isSpeaking;
  const isListening = state === "connected" && mode === "listening";

  // Dynamic orb animation
  const orbScale = isActive ? 1.18 : isListening ? 1.02 : 1;
  const glowOpacity = isActive ? 0.5 : isListening ? 0.15 : 0.05;
  const ringScale = isActive ? 1.35 : isListening ? 1.05 : 1;

  const statusText =
    state === "connecting"
      ? elapsed >= 10 ? "Taking longer than expected..." : "Connecting to Vizzy..."
      : state === "error" ? "Connection failed"
      : isActive ? "Vizzy is speaking..."
      : state === "connected" ? "Listening..."
      : "Ready";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={handleEnd}
          className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vizzy Live</p>
        </div>
        <button
          onClick={handleEnd}
          className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Center: Orb */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="relative">
          {/* Outer glow */}
          <motion.div
            className="absolute rounded-full"
            animate={{
              scale: ringScale,
              opacity: glowOpacity,
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{
              inset: "-48px",
              borderRadius: "50%",
              background: "radial-gradient(circle, hsl(172 66% 50% / 0.4) 0%, transparent 70%)",
            }}
          />

          {/* Pulse rings */}
          {isActive && (
            <>
              <motion.div
                className="absolute rounded-full border border-primary/20"
                animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                style={{ inset: "-32px", borderRadius: "50%" }}
              />
              <motion.div
                className="absolute rounded-full border border-primary/15"
                animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                style={{ inset: "-32px", borderRadius: "50%" }}
              />
            </>
          )}

          {/* Inner ring */}
          <motion.div
            className="absolute rounded-full border-2"
            animate={{
              scale: isActive ? 1.1 : 1,
              borderColor: isActive
                ? "hsl(172 66% 50% / 0.7)"
                : isListening
                ? "hsl(172 66% 50% / 0.4)"
                : "hsl(172 66% 50% / 0.15)",
            }}
            transition={{ duration: 0.25 }}
            style={{ inset: "-16px", borderRadius: "50%" }}
          />

          {/* Connecting ping */}
          {state === "connecting" && (
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{ margin: "-24px", borderRadius: "50%", background: "hsl(172 66% 50% / 0.12)" }}
            />
          )}

          {/* Avatar orb */}
          <motion.div
            className={cn(
              "w-32 h-32 rounded-full overflow-hidden shadow-2xl",
              state === "connected" ? "ring-4 ring-primary/60" :
              state === "connecting" ? "ring-4 ring-primary/30" :
              state === "error" ? "ring-4 ring-destructive/50" : "ring-4 ring-muted"
            )}
            animate={{ scale: orbScale }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              boxShadow: isActive
                ? "0 0 80px 20px hsl(172 66% 50% / 0.4)"
                : isListening
                ? "0 0 30px 5px hsl(172 66% 50% / 0.15)"
                : state === "error"
                ? "0 0 20px 5px hsl(var(--destructive) / 0.3)"
                : "none",
            }}
          >
            <img src={assistantHelper} alt="Vizzy" className="w-full h-full object-cover" draggable={false} />
          </motion.div>

          {/* Connecting spinner */}
          {state === "connecting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
          )}
        </div>

        {/* Status text */}
        <div className="flex flex-col items-center gap-2">
          <p className={cn(
            "text-sm font-medium",
            state === "error" ? "text-destructive" : "text-muted-foreground"
          )}>
            {statusText}
          </p>

          {/* Mic indicator */}
          {isListening && (
            <motion.div
              className="flex items-center gap-2 text-xs text-primary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Speak now</span>
            </motion.div>
          )}
        </div>

        {/* Error / Timeout actions */}
        {state === "error" && (
          <button
            onClick={startSession}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        )}
        {state === "connecting" && elapsed >= 10 && (
          <button
            onClick={handleEnd}
            className="px-5 py-2.5 rounded-xl bg-muted text-foreground text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Transcripts */}
      <div className="w-full max-w-lg mx-auto px-4 pb-4 max-h-[35vh] overflow-y-auto">
        <AnimatePresence>
          {transcripts.slice(-8).map((t: VizzyVoiceTranscript) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn(
                "mb-2 px-4 py-2.5 rounded-2xl text-sm max-w-[85%]",
                t.role === "user"
                  ? "ml-auto bg-primary/10 text-foreground"
                  : "mr-auto bg-muted text-foreground"
              )}
            >
              <span className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                {t.role === "user" ? "You" : "Vizzy"}
              </span>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Bottom: End Call */}
      <div className="pb-8 pt-2 flex flex-col items-center gap-3">
        <button
          onClick={handleEnd}
          className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-destructive text-destructive-foreground font-semibold shadow-lg hover:bg-destructive/90 transition-colors text-sm"
        >
          <MicOff className="w-5 h-5" />
          End Call
        </button>
      </div>
    </div>
  );
}
