import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { Mic, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useVizzyContext } from "@/hooks/useVizzyContext";
import { buildVizzyContext } from "@/lib/vizzyContext";

const ALLOWED_EMAIL = "sattar@rebar.shop";

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
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const sessionActiveRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { loadFullContext } = useVizzyContext();

  // Pre-load context once
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadFullContext().catch(() => {});
  }, [loadFullContext]);

  const conversation = useConversation({
    onConnect: () => {
      sessionActiveRef.current = true;
      console.warn("Vizzy voice connected");
    },
    onDisconnect: () => {
      setIsConnecting(false);
      sessionActiveRef.current = false;
      const entries = transcriptRef.current;
      if (entries.length > 0) {
        supabase.from("vizzy_interactions").insert({
          user_id: userId,
          transcript: entries as any,
          session_ended_at: new Date().toISOString(),
        }).then(({ error }) => { if (error) console.error(error); });
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

  const start = useCallback(async () => {
    if (sessionActiveRef.current || isConnecting) return;
    setIsConnecting(true);
    setTranscript([]);
    transcriptRef.current = [];
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token");
      if (error || !data?.token) throw new Error(error?.message ?? "No token received");

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
        overrides: { agent: { language: "" } },
      });

      const snap = await loadFullContext();
      if (snap) {
        conversation.sendContextualUpdate(buildVizzyContext(snap));
      }
    } catch (err) {
      console.error("Failed to start Vizzy voice:", err);
      setIsConnecting(false);
      sessionActiveRef.current = false;
    }
  }, [conversation, loadFullContext, isConnecting]);

  const stop = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (err) {
      console.error("Error ending Vizzy session:", err);
      sessionActiveRef.current = false;
      setIsConnecting(false);
    }
  }, [conversation]);

  return (
    <>
      {!isActive && (
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
