import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { X, Mic, MicOff, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function VoiceChatOverlay() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const intentionalStopRef = useRef(false);

  // Listen for external open requests
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      startSession();
    };
    window.addEventListener("open-voice-chat", handler);
    return () => window.removeEventListener("open-voice-chat", handler);
  }, []);

  // Timer
  useEffect(() => {
    if (status === "connected" && !timerRef.current) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    if (status !== "connected" && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const conversation = useConversation({
    onConnect: () => setStatus("connected"),
    onDisconnect: () => {
      if (!intentionalStopRef.current) setStatus("error");
    },
    onError: (error: any) => {
      console.error("Voice chat error:", error);
      setStatus("error");
    },
  });

  const startSession = useCallback(async () => {
    try {
      setStatus("connecting");
      setElapsed(0);
      intentionalStopRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token");
      if (error || !data?.signed_url) throw new Error("Failed to get voice token");

      await conversation.startSession({ signedUrl: data.signed_url, connectionType: "websocket" });
    } catch (err) {
      console.error("Voice chat start failed:", err);
      setStatus("error");
    }
  }, [conversation]);

  const stopSession = useCallback(async () => {
    intentionalStopRef.current = true;
    try {
      await conversation.endSession();
    } catch {}
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    setStatus("idle");
    setMuted(false);
    setOpen(false);
  }, [conversation]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const statusLabel =
    status === "connecting" ? "Connecting..." :
    status === "error" ? "Connection lost" :
    conversation.isSpeaking ? "Speaking..." : "Listening...";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md"
        >
          {/* Close */}
          <button
            onClick={stopSession}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-destructive flex items-center justify-center hover:bg-destructive/80 transition-colors z-10"
          >
            <X className="w-5 h-5 text-destructive-foreground" />
          </button>

          {/* Timer */}
          {status === "connected" && (
            <div className="absolute top-5 left-5 z-10">
              <span className="text-sm tabular-nums text-white/60 font-mono bg-white/10 px-3 py-1.5 rounded-full">
                {formatTime(elapsed)}
              </span>
            </div>
          )}

          {/* Center */}
          <div className="flex flex-col items-center gap-6">
            <motion.div
              className={cn(
                "w-28 h-28 rounded-full flex items-center justify-center",
                "bg-gradient-to-br from-primary/30 to-primary/10",
                "ring-4 transition-all duration-300",
                conversation.isSpeaking
                  ? "ring-primary shadow-[0_0_60px_rgba(var(--primary),0.4)]"
                  : status === "error"
                  ? "ring-destructive/50"
                  : "ring-white/20"
              )}
              animate={
                conversation.isSpeaking
                  ? { scale: [1, 1.08, 1] }
                  : status === "connecting"
                  ? { opacity: [0.5, 1, 0.5] }
                  : { scale: 1 }
              }
              transition={{
                duration: conversation.isSpeaking ? 1.5 : 2,
                repeat: conversation.isSpeaking || status === "connecting" ? Infinity : 0,
                ease: "easeInOut",
              }}
            >
              <span className="text-5xl">🧠</span>
            </motion.div>

            <div className="text-center">
              <h2 className="text-lg font-semibold text-white mb-1">Live Voice Chat</h2>
              <p className="text-sm text-white/50">{statusLabel}</p>
            </div>

            {status === "error" && (
              <button
                onClick={startSession}
                className="text-sm text-primary hover:underline"
              >
                Tap to reconnect
              </button>
            )}
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-8 inset-x-0 flex items-center justify-center gap-4">
            <button
              onClick={() => {
                const next = !muted;
                setMuted(next);
                mediaStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
              }}
              className={cn(
                "p-4 rounded-full transition-colors",
                muted ? "bg-destructive text-destructive-foreground" : "bg-white/10 hover:bg-white/20 text-white"
              )}
            >
              {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button
              onClick={stopSession}
              className="p-4 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
