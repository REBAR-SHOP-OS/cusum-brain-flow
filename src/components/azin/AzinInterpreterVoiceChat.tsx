import { useEffect, useRef, useState } from "react";
import { X, Mic, Loader2, Volume2 } from "lucide-react";
import { useAzinVoiceInterpreter, InterpreterTranscript } from "@/hooks/useAzinVoiceInterpreter";
import { cn } from "@/lib/utils";
import azinAvatar from "@/assets/helpers/azin-helper.png";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";

interface Props {
  onClose: () => void;
}

export function AzinInterpreterVoiceChat({ onClose }: Props) {
  const {
    state, transcripts, isSpeaking, mode,
    startSession, endSession,
    getInputVolume, getOutputVolume, setVolume,
  } = useAzinVoiceInterpreter();

  const bottomRef = useRef<HTMLDivElement>(null);
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [volumeVal, setVolumeVal] = useState(80);
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

  // Audio levels
  useEffect(() => {
    let animId: number;
    const tick = () => {
      setInputLevel(getInputVolume());
      setOutputLevel(getOutputVolume());
      animId = requestAnimationFrame(tick);
    };
    if (state === "connected") {
      animId = requestAnimationFrame(tick);
    } else {
      setInputLevel(0);
      setOutputLevel(0);
    }
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [state, getInputVolume, getOutputVolume]);

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

  const handleVolumeChange = (val: number[]) => {
    const v = val[0];
    setVolumeVal(v);
    setVolume(v / 100);
  };

  const statusLabel =
    state === "connecting"
      ? connectingElapsed >= 10 ? "Taking longer than expected..." : "Connecting to AZIN..."
      : state === "error" ? "Connection failed"
      : mode === "speaking" || isSpeaking ? "AZIN is translating..."
      : state === "connected" ? "Listening..."
      : "";

  const glowIntensity = Math.max(outputLevel, inputLevel);
  const orbScale = 1 + outputLevel * 0.25 + inputLevel * 0.1;

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
          <div className="absolute rounded-full transition-none" style={{
            inset: "-32px", borderRadius: "50%",
            background: `radial-gradient(circle, hsl(var(--primary) / ${0.05 + glowIntensity * 0.25}) 0%, transparent 70%)`,
            transform: `scale(${1 + glowIntensity * 0.4})`,
          }} />
          <div className="absolute rounded-full border-2 transition-none" style={{
            inset: "-24px", borderRadius: "50%",
            borderColor: `hsl(172 66% 50% / ${0.3 + glowIntensity * 0.5})`,
            transform: `scale(${1 + glowIntensity * 0.15})`,
          }} />
          {state === "connecting" && (
            <div className="absolute inset-0 rounded-full animate-ping" style={{ margin: "-20px", borderRadius: "50%", background: "hsl(172 66% 50% / 0.15)" }} />
          )}
          <div
            className={cn(
              "w-28 h-28 rounded-full overflow-hidden shadow-2xl transition-none",
              state === "connected" ? "ring-4 ring-primary/60" :
              state === "connecting" ? "ring-4 ring-primary/30" :
              state === "error" ? "ring-4 ring-destructive/50" : "ring-4 ring-muted"
            )}
            style={{
              transform: `scale(${state === "connected" ? orbScale : 1})`,
              boxShadow: state === "connected"
                ? `0 0 ${40 + glowIntensity * 60}px ${glowIntensity * 20}px hsl(172 66% 50% / ${0.15 + glowIntensity * 0.35})`
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

        {/* Audio levels */}
        {state === "connected" && (
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Mic className="w-3 h-3" />
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-none" style={{ width: `${Math.min(inputLevel * 100, 100)}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3 h-3" />
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-none" style={{ width: `${Math.min(outputLevel * 100, 100)}%`, background: "hsl(172 66% 50%)" }} />
              </div>
            </div>
          </div>
        )}

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
                {t.role === "user" ? "You" : "AZIN"}
              </span>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Volume + End */}
      <div className="pb-8 flex flex-col items-center gap-4">
        {state === "connected" && (
          <div className="flex items-center gap-3 w-48">
            <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <Slider value={[volumeVal]} onValueChange={handleVolumeChange} max={100} min={0} step={1} className="flex-1" />
          </div>
        )}
        <button onClick={handleClose} className="flex items-center gap-2 px-6 py-3 rounded-full bg-destructive text-destructive-foreground font-medium shadow-lg hover:bg-destructive/90 transition-colors">
          <Mic className="w-5 h-5" />
          End Call
        </button>
      </div>
    </motion.div>
  );
}
