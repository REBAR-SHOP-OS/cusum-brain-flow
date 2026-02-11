import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { X, ArrowLeft, Mic, MicOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useVizzyContext } from "@/hooks/useVizzyContext";
import { buildVizzyContext } from "@/lib/vizzyContext";
import type { VizzyBusinessSnapshot } from "@/hooks/useVizzyContext";

const ALLOWED_EMAIL = "sattar@rebar.shop";
const MAX_RETRIES = 2;

interface TranscriptEntry {
  role: "user" | "agent";
  text: string;
  id: string;
}

export default function VizzyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const [status, setStatus] = useState<"starting" | "connected" | "error" | "reconnecting">("starting");
  const [muted, setMuted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const intentionalStopRef = useRef(false);
  const retryCountRef = useRef(0);
  const snapshotRef = useRef<VizzyBusinessSnapshot | null>(null);
  const { loadFullContext } = useVizzyContext();

  const saveTranscript = useCallback(async (entries: TranscriptEntry[]) => {
    if (!user || entries.length === 0) return;
    try {
      await supabase.from("vizzy_interactions").insert({
        user_id: user.id,
        transcript: entries as any,
        session_ended_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to save Vizzy transcript:", err);
    }
  }, [user]);

  const buildConversationMemory = useCallback(() => {
    const entries = transcriptRef.current;
    if (entries.length === 0) return "";
    const lines = entries
      .slice(-20)
      .map((e) => `${e.role === "user" ? "CEO" : "Vizzy"}: ${e.text}`)
      .join("\n");
    return `\n═══ CONVERSATION MEMORY (session was interrupted, continuing) ═══\nThe following is what was discussed before the interruption. Continue naturally from where you left off. Do NOT greet the CEO again or repeat yourself.\n\n${lines}\n\n═══ END CONVERSATION MEMORY ═══`;
  }, []);

  // Use a ref so the disconnect handler can call reconnect without circular deps
  const reconnectRef = useRef<() => void>(() => {});

  const conversation = useConversation({
    onConnect: () => {
      sessionActiveRef.current = true;
      setStatus("connected");
    },
    onDisconnect: () => {
      sessionActiveRef.current = false;
      if (intentionalStopRef.current) {
        saveTranscript(transcriptRef.current);
        navigate("/home");
        return;
      }
      // Unexpected drop → retry
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        console.warn(`Vizzy dropped, retrying (${retryCountRef.current}/${MAX_RETRIES})...`);
        setStatus("reconnecting");
        setTimeout(() => reconnectRef.current(), 1500);
      } else {
        saveTranscript(transcriptRef.current);
        navigate("/home");
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
    onError: (error: any) => {
      console.error("Vizzy voice error:", error);
      if (retryCountRef.current >= MAX_RETRIES) {
        setStatus("error");
      }
    },
  });

  // Wire reconnect ref to use the conversation instance
  useEffect(() => {
    reconnectRef.current = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token");
        if (error || !data?.signed_url) throw new Error(error?.message ?? "No signed URL received");

        await conversation.startSession({
          signedUrl: data.signed_url,
          connectionType: "websocket",
        });

        const snap = snapshotRef.current;
        if (snap) {
          const context = buildVizzyContext(snap);
          const memory = buildConversationMemory();
          conversation.sendContextualUpdate(context + memory);
        }

        retryCountRef.current = 0;
      } catch (err) {
        console.error("Vizzy reconnect failed:", err);
        setStatus("error");
      }
    };
  }, [conversation, buildConversationMemory]);

  const stop = useCallback(async () => {
    intentionalStopRef.current = true;
    try {
      await saveTranscript(transcriptRef.current);
      await conversation.endSession();
    } catch (err) {
      console.error("Error ending Vizzy session:", err);
    }
    navigate("/home");
  }, [conversation, navigate, saveTranscript]);

  // Auto-start on mount
  useEffect(() => {
    if (startedRef.current) return;
    if (!user || user.email !== ALLOWED_EMAIL) return;
    startedRef.current = true;

    (async () => {
      try {
        const [snap, stream] = await Promise.all([
          loadFullContext(),
          navigator.mediaDevices.getUserMedia({ audio: true }),
        ]);
        snapshotRef.current = snap;
        mediaStreamRef.current = stream;

        const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token");
        if (error || !data?.signed_url) throw new Error(error?.message ?? "No signed URL received");

        await conversation.startSession({
          signedUrl: data.signed_url,
          connectionType: "websocket",
        });

        if (snap) {
          conversation.sendContextualUpdate(buildVizzyContext(snap));
        }
      } catch (err) {
        console.error("Failed to start Vizzy voice:", err);
        setStatus("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loadFullContext]);

  // Gate
  if (!user || user.email !== ALLOWED_EMAIL) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p>Access restricted.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm">
      {/* Top bar */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
        <button
          onClick={() => navigate("/home")}
          className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="Back to home"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {(status === "connected" || status === "reconnecting") && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const next = !muted;
                setMuted(next);
                mediaStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
              }}
              className={cn(
                "p-3 rounded-full transition-colors",
                muted ? "bg-yellow-500/80 text-black hover:bg-yellow-500" : "bg-white/10 text-white hover:bg-white/20"
              )}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={stop}
              className="p-3 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
              aria-label="End conversation"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* Avatar */}
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

      {/* Status */}
      <p className="text-lg font-medium text-white/80 mb-6">
        {status === "starting" && "Connecting to Vizzy..."}
        {status === "reconnecting" && "Reconnecting — one moment..."}
        {status === "error" && "Failed to connect. Go back and try again."}
        {status === "connected" && (conversation.isSpeaking ? "Vizzy is speaking..." : "Listening...")}
      </p>

      {/* Transcript */}
      <div ref={scrollRef} className="w-full max-w-lg max-h-60 overflow-y-auto px-6 space-y-3 scrollbar-thin">
        {transcript.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "text-sm px-4 py-2 rounded-xl max-w-[85%]",
              entry.role === "user" ? "ml-auto bg-primary/20 text-white/90" : "mr-auto bg-white/10 text-white/90"
            )}
          >
            <span className="text-[10px] uppercase tracking-wider text-white/40 block mb-0.5">
              {entry.role === "user" ? "You" : "Vizzy"}
            </span>
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}
