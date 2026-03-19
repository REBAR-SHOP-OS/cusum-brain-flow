import { useEffect, useRef, useState } from "react";
import { X, Mic, Loader2 } from "lucide-react";
import { useAzinVoiceInterpreter, InterpreterTranscript } from "@/hooks/useAzinVoiceInterpreter";
import { cn } from "@/lib/utils";
import azinAvatar from "@/assets/helpers/azin-helper.png";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onClose: () => void;
}

export function AzinInterpreterVoiceChat({ onClose }: Props) {
  const {
    state, transcripts, isSpeaking, mode,
    startSession, endSession,
  } = useAzinVoiceInterpreter();

  const bottomRef = useRef<HTMLDivElement>(null);
  const [connectingElapsed, setConnectingElapsed] = useState(0);

  // Auto-start
  useEffect(() => {
    startSession();
    return () => { endSession(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Connecting timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (state === "connecting") {
      setConnectingElapsed(0);
      interval = setInterval(() => setConnectingElapsed((e) => e + 1), 1000);
    } else {
      setConnectingElapsed(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [state]);

  const handleClose = () => { endSession(); onClose(); };

  const statusLabel =
    state === "connecting"
      ? connectingElapsed >= 10 ? "Taking longer than expected..." : "Connecting to Nila..."
      : state === "error" ? "Connection failed"
      : mode === "speaking" || isSpeaking ? "Translating..."
      : state === "connected" ? "Listening..."
      : "";

  const isActive = mode === "speaking" || isSpeaking;
  const orbScale = isActive ? 1.15 : 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-background/95 backdrop-blur-xl"
    >
      {/* Close */}
      <div className="w-full flex justify-end p-4">
        <button onClick={handleClose} className="p-2 rounded-full bg-muted hover:bg-accent transition-colors" aria-label="End interpreter">
          <X className="w-6 h-6 text-foreground" />
        </button>
      </div>

      {/* Orb */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="relative">
          {/* Glow ring */}
          <div className="absolute rounded-full transition-all duration-300" style={{
            inset: "-32px", borderRadius: "50%",
            background: isActive
              ? "radial-gradient(circle, hsl(245 58% 55% / 0.3) 0%, transparent 70%)"
              : "radial-gradient(circle, hsl(245 58% 55% / 0.05) 0%, transparent 70%)",
            transform: `scale(${isActive ? 1.3 : 1})`,
          }} />
          {/* Pulse ring */}
          <div className="absolute rounded-full border-2 transition-all duration-300" style={{
            inset: "-24px", borderRadius: "50%",
            borderColor: isActive ? "hsl(245 58% 55% / 0.7)" : "hsl(245 58% 55% / 0.3)",
            transform: `scale(${isActive ? 1.1 : 1})`,
          }} />
          {state === "connecting" && (
            <div className="absolute inset-0 rounded-full animate-ping" style={{ margin: "-20px", borderRadius: "50%", background: "hsl(245 58% 55% / 0.15)" }} />
          )}
          <div
            className={cn(
              "w-28 h-28 rounded-full overflow-hidden shadow-2xl transition-all duration-200",
              state === "connected" ? "ring-4 ring-indigo-500/60" :
              state === "connecting" ? "ring-4 ring-indigo-500/30" :
              state === "error" ? "ring-4 ring-destructive/50" : "ring-4 ring-muted"
            )}
            style={{
              transform: `scale(${state === "connected" ? orbScale : 1})`,
              boxShadow: state === "connected" && isActive
                ? "0 0 60px 15px hsl(245 58% 55% / 0.4)"
                : state === "error" ? "0 0 20px 5px hsl(var(--destructive) / 0.3)" : "none",
            }}
          >
            <img src={azinAvatar} alt="AZIN" className="w-full h-full object-cover" draggable={false} />
          </div>
          {state === "connecting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
          )}
        </div>

        <p className={cn("text-sm font-medium transition-colors", state === "error" ? "text-destructive" : "text-muted-foreground")}>
          {statusLabel}
        </p>

        {state === "error" && (
          <button onClick={startSession} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Try Again
          </button>
        )}
        {state === "connecting" && connectingElapsed >= 10 && (
          <button onClick={handleClose} className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-accent transition-colors">
            Cancel
          </button>
        )}
      </div>

      {/* Transcripts */}
      <div className="w-full max-w-md px-4 pb-2 max-h-[30vh] overflow-y-auto">
        <AnimatePresence>
          {transcripts.slice(-8).map((t: InterpreterTranscript) => (
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
                {t.role === "user" ? "🎙️ Original" : "🔄 Translation"}
              </span>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* End Call */}
      <div className="pb-8 flex flex-col items-center gap-4">
        <button onClick={handleClose} className="flex items-center gap-2 px-6 py-3 rounded-full bg-destructive text-destructive-foreground font-medium shadow-lg hover:bg-destructive/90 transition-colors">
          <Mic className="w-5 h-5" />
          End Call
        </button>
      </div>
    </motion.div>
  );
}
