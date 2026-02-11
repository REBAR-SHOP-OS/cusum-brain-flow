import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { X, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useVizzyContext } from "@/hooks/useVizzyContext";
import { buildVizzyContext } from "@/lib/vizzyContext";

const ALLOWED_EMAIL = "sattar@rebar.shop";

interface TranscriptEntry {
  role: "user" | "agent";
  text: string;
  id: string;
}

export default function VizzyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [status, setStatus] = useState<"starting" | "connected" | "error">("starting");
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const { loadFullContext } = useVizzyContext();

  const conversation = useConversation({
    onConnect: () => setStatus("connected"),
    onDisconnect: () => {
      // Save transcript on disconnect
      saveTranscript(transcript);
      navigate("/home");
    },
    onMessage: (message: any) => {
      if (message.type === "user_transcript") {
        setTranscript((prev) => [
          ...prev,
          { role: "user", text: message.user_transcription_event?.user_transcript ?? "", id: crypto.randomUUID() },
        ]);
      } else if (message.type === "agent_response") {
        setTranscript((prev) => [
          ...prev,
          { role: "agent", text: message.agent_response_event?.agent_response ?? "", id: crypto.randomUUID() },
        ]);
      }
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
    },
    onError: (error: any) => {
      console.error("Vizzy voice error:", error);
      setStatus("error");
    },
  });

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

  const stop = useCallback(async () => {
    await saveTranscript(transcript);
    await conversation.endSession();
    navigate("/home");
  }, [conversation, navigate, transcript, saveTranscript]);

  // Auto-start on mount
  useEffect(() => {
    if (startedRef.current) return;
    if (!user || user.email !== ALLOWED_EMAIL) return;
    startedRef.current = true;

    (async () => {
      try {
        const [snap] = await Promise.all([
          loadFullContext(),
          navigator.mediaDevices.getUserMedia({ audio: true }),
        ]);
        const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token");
        if (error || !data?.token) throw new Error(error?.message ?? "No token received");
        await conversation.startSession({
          conversationToken: data.token,
          connectionType: "webrtc",
          overrides: {
            agent: {
              language: "",
            },
          },
        });

        // Inject full business context
        if (snap) {
          conversation.sendContextualUpdate(buildVizzyContext(snap));
        }
      } catch (err) {
        console.error("Failed to start Vizzy voice:", err);
        setStatus("error");
      }
    })();
  }, [user, conversation, loadFullContext]);

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
        {status === "connected" && (
          <button
            onClick={stop}
            className="p-3 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
            aria-label="End conversation"
          >
            <X className="w-6 h-6" />
          </button>
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
