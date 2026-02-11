import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { Mic, X, WifiOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useVizzyContext } from "@/hooks/useVizzyContext";
import { buildVizzyContext } from "@/lib/vizzyContext";

const ALLOWED_EMAIL = "sattar@rebar.shop";
const MAX_AUTO_RETRIES = 2;

interface TranscriptEntry {
  role: "user" | "agent";
  text: string;
  id: string;
}

/** Outer gate — only mounts the inner component for the allowed user */
export function VoiceVizzy() {
  const { user } = useAuth();
  if (!user || user.email !== ALLOWED_EMAIL) return null;
  return <VoiceVizzyInner userId={user.id} />;
}

/** Inner component — useConversation only initialises when mounted */
function VoiceVizzyInner({ userId }: { userId: string }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [connectionLost, setConnectionLost] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const sessionActiveRef = useRef(false);
  const userRequestedStop = useRef(false);
  const retryCount = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { loadFullContext } = useVizzyContext();

  // Pre-load context once
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadFullContext().catch(() => {});
  }, [loadFullContext]);

  // Cleanup retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      sessionActiveRef.current = true;
      setIsRetrying(false);
      console.warn("Vizzy voice connected");
    },
    onDisconnect: () => {
      setIsConnecting(false);
      sessionActiveRef.current = false;

      // User clicked X — normal flow
      if (userRequestedStop.current) {
        userRequestedStop.current = false;
        const entries = transcriptRef.current;
        if (entries.length > 0) {
          supabase.from("vizzy_interactions").insert({
            user_id: userId,
            transcript: entries as any,
            session_ended_at: new Date().toISOString(),
          }).then(({ error }) => { if (error) console.error(error); });
        }
        return;
      }

      // Unexpected disconnect — auto-retry
      if (retryCount.current < MAX_AUTO_RETRIES) {
        retryCount.current += 1;
        setIsRetrying(true);
        console.warn(`Vizzy: unexpected disconnect, auto-retry ${retryCount.current}/${MAX_AUTO_RETRIES}`);
        retryTimerRef.current = setTimeout(() => {
          startSession();
        }, 2000);
      } else {
        // Retries exhausted — show connection lost UI
        console.warn("Vizzy: retries exhausted, showing connection lost");
        setConnectionLost(true);
        setIsRetrying(false);
      }
    },
    onMessage: (message: any) => {
      if (message.type === "user_transcript") {
        const entry: TranscriptEntry = { role: "user", text: message.user_transcription_event?.user_transcript ?? "", id: crypto.randomUUID() };
        setTranscript((prev) => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
      } else if (message.type === "agent_response") {
        const entry: TranscriptEntry = { role: "agent", text: message.agent_response_event?.agent_response ?? "", id: crypto.randomUUID() };
        setTranscript((prev) => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
      }
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
    },
    onError: (error: any) => console.error("Vizzy voice error:", error),
  });

  const isActive = conversation.status === "connected";

  const startSession = useCallback(async () => {
    if (sessionActiveRef.current || isConnecting) return;
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token");
      if (error || !data?.signed_url) throw new Error(error?.message ?? "No signed URL received");

      await conversation.startSession({
        signedUrl: data.signed_url,
        connectionType: "websocket",
      });

      // Delay contextual update to avoid "Invalid message received" error
      setTimeout(async () => {
        try {
          const snap = await loadFullContext();
          if (snap && sessionActiveRef.current) {
            conversation.sendContextualUpdate(buildVizzyContext(snap));
          }
        } catch (e) {
          console.warn("Failed to send Vizzy context:", e);
        }
      }, 3000);
    } catch (err) {
      console.error("Failed to start Vizzy voice:", err);
      setIsConnecting(false);
      sessionActiveRef.current = false;
      // If this was a retry attempt, show connection lost
      if (retryCount.current > 0) {
        setConnectionLost(true);
        setIsRetrying(false);
      }
    }
  }, [conversation, loadFullContext, isConnecting]);

  const start = useCallback(() => {
    // Fresh start — reset everything
    userRequestedStop.current = false;
    retryCount.current = 0;
    setConnectionLost(false);
    setIsRetrying(false);
    setTranscript([]);
    transcriptRef.current = [];
    startSession();
  }, [startSession]);

  const stop = useCallback(async () => {
    userRequestedStop.current = true;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("Error ending Vizzy session:", err);
      sessionActiveRef.current = false;
      setIsConnecting(false);
    }
  }, [conversation]);

  const dismiss = useCallback(() => {
    setConnectionLost(false);
    setIsRetrying(false);
    retryCount.current = 0;
  }, []);

  return (
    <>
      {/* Default mic button — hidden during active/retrying/lost states */}
      {!isActive && !connectionLost && !isRetrying && (
        <button
          onClick={start}
          disabled={isConnecting}
          className={cn(
            "fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6",
            "flex items-center justify-center w-14 h-14 rounded-full",
            "bg-primary text-primary-foreground shadow-lg",
            "hover:scale-105 active:scale-95 transition-transform",
            isConnecting && "animate-pulse opacity-70"
          )}
          aria-label="Talk to Vizzy"
        >
          <Mic className="w-6 h-6" />
        </button>
      )}

      {/* Connection lost card */}
      {connectionLost && !isActive && (
        <div className="fixed bottom-20 right-4 z-50 md:bottom-6 md:right-6 flex flex-col items-end gap-2">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-4 w-64 space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <WifiOff className="w-5 h-5" />
              <span className="text-sm font-medium">Connection lost</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Vizzy disconnected unexpectedly. Tap to try again.
            </p>
            <div className="flex gap-2">
              <button
                onClick={start}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try Again
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retrying overlay */}
      <AnimatePresence>
        {isRetrying && !isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
          >
            <button
              onClick={stop}
              className="absolute top-6 right-6 p-3 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
              aria-label="Cancel"
            >
              <X className="w-6 h-6" />
            </button>
            <RefreshCw className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-lg font-medium text-white/80">Reconnecting...</p>
            <p className="text-sm text-white/50 mt-1">Attempt {retryCount.current}/{MAX_AUTO_RETRIES}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active session overlay */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
          >
            <button
              onClick={stop}
              className="absolute top-6 right-6 p-3 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
              aria-label="End conversation"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="relative mb-8">
              <div
                className={cn(
                  "w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center",
                  "ring-4 ring-primary/50 transition-all duration-300",
                  conversation.isSpeaking && "ring-primary ring-8 shadow-[0_0_60px_rgba(var(--primary),0.4)]"
                )}
              >
                <span className="text-5xl">🧠</span>
              </div>
              {conversation.isSpeaking && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/30"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </div>

            <p className="text-lg font-medium text-white/80 mb-6">
              {conversation.isSpeaking ? "Vizzy is speaking..." : "Listening..."}
            </p>

            <div
              ref={scrollRef}
              className="w-full max-w-lg max-h-60 overflow-y-auto px-6 space-y-3 scrollbar-thin"
            >
              {transcript.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "text-sm px-4 py-2 rounded-xl max-w-[85%]",
                    entry.role === "user"
                      ? "ml-auto bg-primary/20 text-white/90"
                      : "mr-auto bg-white/10 text-white/90"
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-0.5">
                    {entry.role === "user" ? "You" : "Vizzy"}
                  </span>
                  {entry.text}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
