import { useEffect, useRef, useState } from "react";
import { X, Mic, Loader2, Volume2 } from "lucide-react";
import { useVizzyVoice, TranscriptEntry } from "@/hooks/useVizzyVoice";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getUserPrimaryAgent } from "@/lib/userAgentMap";
import assistantHelper from "@/assets/helpers/assistant-helper.png";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";

interface VizzyVoiceChatProps {
  onClose: () => void;
}

export function VizzyVoiceChat({ onClose }: VizzyVoiceChatProps) {
  const {
    voiceState, transcripts, isSpeaking, mode,
    startSession, endSession,
    getInputVolume, getOutputVolume, setVolume,
  } = useVizzyVoice();
  const { user } = useAuth();
  const agent = getUserPrimaryAgent(user?.email);
  const avatarImg = agent?.image || assistantHelper;
  const agentName = agent?.name || "Vizzy";
  const bottomRef = useRef<HTMLDivElement>(null);

  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [volumeVal, setVolumeVal] = useState(80);
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

  // Audio-reactive animation loop
  useEffect(() => {
    let animId: number;
    const tick = () => {
      setInputLevel(getInputVolume());
      setOutputLevel(getOutputVolume());
      animId = requestAnimationFrame(tick);
    };
    if (voiceState === "connected") {
      animId = requestAnimationFrame(tick);
    } else {
      setInputLevel(0);
      setOutputLevel(0);
    }
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [voiceState, getInputVolume, getOutputVolume]);

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

  const handleVolumeChange = (val: number[]) => {
    const v = val[0];
    setVolumeVal(v);
    setVolume(v / 100);
  };

  const statusLabel =
    voiceState === "connecting"
      ? connectingElapsed >= 10
        ? "Taking longer than expected..."
        : "Connecting to " + agentName + "..."
      : voiceState === "error"
      ? "Connection failed"
      : mode === "speaking" || isSpeaking
      ? agentName + " is speaking..."
      : voiceState === "connected"
      ? "Listening..."
      : "";

  // Audio-reactive orb styles
  const orbScale = 1 + outputLevel * 0.25 + inputLevel * 0.1;
  const glowIntensity = Math.max(outputLevel, inputLevel);

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
          {/* Audio-reactive outer glow */}
          <div
            className="absolute rounded-full transition-none"
            style={{
              inset: "-32px",
              borderRadius: "50%",
              background: `radial-gradient(circle, hsl(var(--primary) / ${0.05 + glowIntensity * 0.25}) 0%, transparent 70%)`,
              transform: `scale(${1 + glowIntensity * 0.4})`,
            }}
          />

          {/* Audio-reactive ring */}
          <div
            className="absolute rounded-full border-2 transition-none"
            style={{
              inset: "-24px",
              borderRadius: "50%",
              borderColor: `hsl(172 66% 50% / ${0.3 + glowIntensity * 0.5})`,
              transform: `scale(${1 + glowIntensity * 0.15})`,
            }}
          />

          {/* Outer pulse ring (connecting only) */}
          {voiceState === "connecting" && (
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{ margin: "-20px", borderRadius: "50%", background: "hsl(172 66% 50% / 0.15)" }}
            />
          )}

          {/* Avatar with audio-reactive scale */}
          <div
            className={cn(
              "w-28 h-28 rounded-full overflow-hidden shadow-2xl transition-none",
              voiceState === "connected" ? "ring-4 ring-primary/60" :
              voiceState === "connecting" ? "ring-4 ring-primary/30" :
              voiceState === "error" ? "ring-4 ring-destructive/50" : "ring-4 ring-muted"
            )}
            style={{
              transform: `scale(${voiceState === "connected" ? orbScale : 1})`,
              boxShadow: voiceState === "connected"
                ? `0 0 ${40 + glowIntensity * 60}px ${glowIntensity * 20}px hsl(172 66% 50% / ${0.15 + glowIntensity * 0.35})`
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

          {/* Connecting spinner overlay */}
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

        {/* Audio level indicators */}
        {voiceState === "connected" && (
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Mic className="w-3 h-3" />
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-none"
                  style={{ width: `${Math.min(inputLevel * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3 h-3" />
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-none"
                  style={{
                    width: `${Math.min(outputLevel * 100, 100)}%`,
                    background: "hsl(172 66% 50%)",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Retry / Cancel on error or timeout */}
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
          {transcripts.slice(-6).map((t: TranscriptEntry) => (
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

      {/* Volume slider + End call */}
      <div className="pb-8 flex flex-col items-center gap-4">
        {voiceState === "connected" && (
          <div className="flex items-center gap-3 w-48">
            <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <Slider
              value={[volumeVal]}
              onValueChange={handleVolumeChange}
              max={100}
              min={0}
              step={1}
              className="flex-1"
            />
          </div>
        )}
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
