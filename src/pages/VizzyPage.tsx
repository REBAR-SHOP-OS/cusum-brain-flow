import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { X, Mic, MicOff, Volume2, WifiOff, Camera } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useVizzyContext } from "@/hooks/useVizzyContext";
import { buildVizzyContext } from "@/lib/vizzyContext";
import type { VizzyBusinessSnapshot } from "@/hooks/useVizzyContext";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { FileText, Check, XCircle } from "lucide-react";

const ALLOWED_EMAIL = "sattar@rebar.shop";
const MAX_RETRIES = 2;

interface TranscriptEntry {
  role: "user" | "agent";
  text: string;
  id: string;
  type?: "text" | "quotation";
  quotation?: QuotationDraft;
}

interface QuotationDraft {
  customerName: string;
  projectName?: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  notes?: string;
  status: "draft" | "approved" | "dismissed";
}

export default function VizzyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const [status, setStatus] = useState<"starting" | "connected" | "error" | "reconnecting">("starting");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showVolume, setShowVolume] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeQuotation, setActiveQuotation] = useState<{ id: string; draft: QuotationDraft } | null>(null);
  const [silentMode, setSilentMode] = useState(false);
  const startedRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const intentionalStopRef = useRef(false);
  const retryCountRef = useRef(0);
  const snapshotRef = useRef<VizzyBusinessSnapshot | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prevVolumeRef = useRef(80);
  const silentModeRef = useRef(false);
  const silentIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { loadFullContext } = useVizzyContext();

  // Session timer
  useEffect(() => {
    if (status === "connected" && !timerRef.current) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (silentIntervalRef.current) { clearInterval(silentIntervalRef.current); silentIntervalRef.current = null; }
    };
  }, [status]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const saveTranscript = useCallback(async (entries: TranscriptEntry[]) => {
    if (!user || entries.length === 0) return;
    try {
      // Save to vizzy_interactions (existing)
      await supabase.from("vizzy_interactions").insert({
        user_id: user.id,
        transcript: entries as any,
        session_ended_at: new Date().toISOString(),
      });

      // Also save as a chat_session + chat_messages so it appears in Agent Workspace sidebar
      const textEntries = entries.filter((e) => e.type !== "quotation" && e.text.trim());
      if (textEntries.length === 0) return;

      const firstUserMsg = textEntries.find((e) => e.role === "user")?.text || "Voice Chat";
      const title = firstUserMsg.slice(0, 80) + (firstUserMsg.length > 80 ? "..." : "");

      const { data: session, error: sessionError } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title: `🎙️ ${title}`,
          agent_name: "Vizzy",
          agent_color: "bg-yellow-400",
        })
        .select("id")
        .single();

      if (sessionError || !session) {
        console.error("Failed to create chat session for voice transcript:", sessionError);
        return;
      }

      const messagesToInsert = textEntries.map((entry) => ({
        session_id: session.id,
        role: entry.role === "user" ? "user" as const : "agent" as const,
        content: entry.text,
        agent_type: "assistant",
      }));

      const { error: msgError } = await supabase.from("chat_messages").insert(messagesToInsert);
      if (msgError) console.error("Failed to save voice transcript messages:", msgError);
    } catch (err) {
      console.error("Failed to save Vizzy transcript:", err);
    }
  }, [user]);

  const buildConversationMemory = useCallback(() => {
    const entries = transcriptRef.current;
    if (entries.length === 0) return "";
    const lines = entries
      .filter((e) => e.type !== "quotation")
      .slice(-20)
      .map((e) => `${e.role === "user" ? "CEO" : "Vizzy"}: ${e.text}`)
      .join("\n");
    return `\n═══ CONVERSATION MEMORY (session was interrupted, continuing) ═══\nThe following is what was discussed before the interruption. Continue naturally from where you left off. Do NOT greet the CEO again or repeat yourself.\n\n${lines}\n\n═══ END CONVERSATION MEMORY ═══`;
  }, []);

  const reconnectRef = useRef<() => void>(() => {});

  const addQuotationCard = useCallback((draft: QuotationDraft) => {
    const id = crypto.randomUUID();
    const entry: TranscriptEntry = {
      role: "agent",
      text: `Quotation draft for ${draft.customerName}`,
      id,
      type: "quotation",
      quotation: draft,
    };
    setTranscript((prev) => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
    setActiveQuotation({ id, draft });
  }, []);

  const conversation = useConversation({
    clientTools: {
      draft_quotation: (params: {
        customer_name: string;
        project_name?: string;
        items: { description: string; quantity: number; unit_price: number }[];
        notes?: string;
      }) => {
        const draft: QuotationDraft = {
          customerName: params.customer_name,
          projectName: params.project_name,
          items: params.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unit_price,
          })),
          notes: params.notes,
          status: "draft",
        };
        addQuotationCard(draft);
        return "Quotation draft displayed to CEO for review. Wait for their approval before sending.";
      },
    },
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
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        setStatus("reconnecting");
        setTimeout(() => reconnectRef.current(), 1500);
      } else {
        saveTranscript(transcriptRef.current);
        navigate("/home");
      }
    },
    onMessage: (message: any) => {
      if (message.type === "user_transcript") {
        const userText = message.user_transcription_event?.user_transcript ?? "";
        const entry: TranscriptEntry = {
          role: "user",
          text: userText,
          id: crypto.randomUUID(),
          type: "text",
        };
        setTranscript((prev) => { const next = [...prev, entry]; transcriptRef.current = next; return next; });

        // Silent mode detection
        const lower = userText.toLowerCase().trim();
        const SILENCE_TRIGGERS = ["silent", "be quiet", "shut up", "hush", "shhh", "be silent"];
        const WAKE_TRIGGERS = ["vizzy", "hey vizzy"];

        const shouldSilence = SILENCE_TRIGGERS.some((t) => lower.includes(t));
        const shouldWake = WAKE_TRIGGERS.some((t) => lower.includes(t));

        if (shouldSilence && !shouldWake) {
          setSilentMode(true);
          silentModeRef.current = true;
          prevVolumeRef.current = volume;
          try { conversation.setVolume({ volume: 0 }); } catch {}
          conversation.sendContextualUpdate(
            "SYSTEM OVERRIDE: CEO activated silent mode. You MUST NOT speak, respond, or check in. Do NOT ask if they are there. Do NOT say anything at all. Remain completely silent until CEO says your name 'Vizzy'. This is a hard rule — zero exceptions."
          );
          // Start activity pings to prevent idle "are you there?" prompts
          if (!silentIntervalRef.current) {
            silentIntervalRef.current = setInterval(() => {
              try { conversation.sendUserActivity(); } catch {}
            }, 15000);
          }
        } else if (shouldWake) {
          setSilentMode(false);
          silentModeRef.current = false;
          // Clear activity pings
          if (silentIntervalRef.current) { clearInterval(silentIntervalRef.current); silentIntervalRef.current = null; }
          try { conversation.setVolume({ volume: prevVolumeRef.current / 100 }); } catch {}
          conversation.sendContextualUpdate(
            "CEO called your name. You may speak again. Briefly summarize any notes you took during the silent period, then continue normally."
          );
        }
      } else if (message.type === "agent_response") {
        const entry: TranscriptEntry = {
          role: "agent",
          text: message.agent_response_event?.agent_response ?? "",
          id: crypto.randomUUID(),
          type: "text",
        };
        setTranscript((prev) => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
        // Reinforce silence if agent speaks during silent mode
        if (silentModeRef.current) {
          conversation.sendContextualUpdate(
            "SYSTEM OVERRIDE: You are STILL in silent mode. Do NOT speak. Do NOT check in. Do NOT respond. Remain completely silent until CEO says 'Vizzy'."
          );
        }
      }
    },
    onError: (error: any) => {
      console.error("Vizzy voice error:", error);
      if (retryCountRef.current >= MAX_RETRIES) setStatus("error");
    },
  });

  // Volume control
  useEffect(() => {
    try { conversation.setVolume({ volume: volume / 100 }); } catch {}
  }, [volume, conversation]);

  useEffect(() => {
    reconnectRef.current = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token");
        if (error || !data?.signed_url) throw new Error(error?.message ?? "No signed URL received");
        await conversation.startSession({ signedUrl: data.signed_url, connectionType: "websocket" });
        const snap = snapshotRef.current;
        if (snap) {
          conversation.sendContextualUpdate(buildVizzyContext(snap) + buildConversationMemory());
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

  const manualReconnect = useCallback(() => {
    retryCountRef.current = 0;
    setStatus("reconnecting");
    reconnectRef.current();
  }, []);

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
        await conversation.startSession({ signedUrl: data.signed_url, connectionType: "websocket" });
        if (snap) conversation.sendContextualUpdate(buildVizzyContext(snap));
      } catch (err) {
        console.error("Failed to start Vizzy voice:", err);
        setStatus("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loadFullContext]);

  // Update quotation status
  const updateQuotationStatus = useCallback((id: string, newStatus: "approved" | "dismissed") => {
    setTranscript((prev) => {
      const next = prev.map((e) =>
        e.id === id && e.quotation ? { ...e, quotation: { ...e.quotation, status: newStatus } } : e
      );
      transcriptRef.current = next;
      return next;
    });
    setActiveQuotation(null);
    if (newStatus === "approved") {
      conversation.sendContextualUpdate(`CEO APPROVED the quotation draft. Proceed to finalize and send it.`);
    } else {
      conversation.sendContextualUpdate(`CEO DISMISSED the quotation draft. Ask if they want changes.`);
    }
  }, [conversation]);

  if (!user || user.email !== ALLOWED_EMAIL) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p>Access restricted.</p>
      </div>
    );
  }

  const statusLabel =
    status === "starting" ? "Connecting..." :
    status === "reconnecting" ? "Reconnecting..." :
    status === "error" ? "Connection lost" :
    silentMode ? "Silent mode — taking notes..." :
    conversation.isSpeaking ? "Vizzy is speaking..." : "Listening...";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
      {/* Close button — top right */}
      <button
        onClick={stop}
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-destructive flex items-center justify-center hover:bg-destructive/80 transition-colors z-10"
        aria-label="Close"
      >
        <X className="w-5 h-5 text-destructive-foreground" />
      </button>

      {/* Timer — top left */}
      {status === "connected" && (
        <div className="absolute top-5 left-5 z-10">
          <span className="text-sm tabular-nums text-white/60 font-mono bg-white/10 px-3 py-1.5 rounded-full">
            {formatTime(elapsed)}
          </span>
        </div>
      )}

      {/* Center avatar */}
      <div className="flex flex-col items-center gap-6">
        <motion.div
          className={cn(
            "w-32 h-32 rounded-full flex items-center justify-center",
            "bg-gradient-to-br from-primary/30 to-primary/10",
            "ring-4 transition-all duration-300",
            silentMode
              ? "ring-amber-500/50 opacity-60"
              : conversation.isSpeaking
              ? "ring-primary shadow-[0_0_60px_rgba(var(--primary),0.4)]"
              : status === "error"
              ? "ring-destructive/50"
              : "ring-white/20"
          )}
          animate={
            conversation.isSpeaking
              ? { scale: [1, 1.08, 1] }
              : status === "reconnecting"
              ? { opacity: [0.5, 1, 0.5] }
              : { scale: 1 }
          }
          transition={{
            duration: conversation.isSpeaking ? 1.5 : 2,
            repeat: conversation.isSpeaking || status === "reconnecting" ? Infinity : 0,
            ease: "easeInOut",
          }}
        >
          <span className="text-6xl">🧠</span>
        </motion.div>

        <div className="text-center">
          <h1 className="text-xl font-semibold text-white mb-1">Vizzy</h1>
          <p className="text-sm text-white/50">{statusLabel}</p>
          {silentMode && (
            <span className="inline-block mt-2 text-[10px] uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 font-semibold">
              Silent
            </span>
          )}
        </div>

        {/* Error retry */}
        {status === "error" && (
          <button
            onClick={manualReconnect}
            className="text-sm text-primary hover:underline"
          >
            Tap to reconnect
          </button>
        )}
      </div>

      {/* Quotation floating card */}
      <AnimatePresence>
        {activeQuotation && activeQuotation.draft.status === "draft" && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="absolute inset-x-4 bottom-28 max-w-md mx-auto bg-card border border-border rounded-2xl p-5 shadow-2xl z-20"
          >
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Quotation Draft</span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium bg-amber-500/20 text-amber-600">
                draft
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Customer:</span> <span className="font-medium text-foreground">{activeQuotation.draft.customerName}</span></p>
              {activeQuotation.draft.projectName && (
                <p><span className="text-muted-foreground">Project:</span> <span className="text-foreground">{activeQuotation.draft.projectName}</span></p>
              )}
            </div>
            <div className="mt-3 border-t border-border pt-2">
              {activeQuotation.draft.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs py-1">
                  <span className="text-foreground">{item.description}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {item.quantity} × ${item.unitPrice.toFixed(2)} = ${(item.quantity * item.unitPrice).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border mt-2">
                <span className="text-foreground">Total</span>
                <span className="text-foreground tabular-nums">
                  ${activeQuotation.draft.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toFixed(2)}
                </span>
              </div>
            </div>
            {activeQuotation.draft.notes && (
              <p className="text-xs text-muted-foreground mt-2 italic">{activeQuotation.draft.notes}</p>
            )}
            <div className="flex gap-2 mt-4">
              <Button size="sm" className="gap-1 h-9 flex-1" onClick={() => updateQuotationStatus(activeQuotation.id, "approved")}>
                <Check className="w-3.5 h-3.5" /> Approve & Send
              </Button>
              <Button size="sm" variant="outline" className="gap-1 h-9 flex-1" onClick={() => updateQuotationStatus(activeQuotation.id, "dismissed")}>
                <XCircle className="w-3.5 h-3.5" /> Dismiss
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom control bar */}
      <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-4 px-6">
        {/* Camera */}
        <button
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
          aria-label="Camera"
        >
          <Camera className="w-5 h-5" />
        </button>

        {/* Volume */}
        <div className="relative">
          <button
            onClick={() => setShowVolume(!showVolume)}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            aria-label="Volume"
          >
            <Volume2 className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {showVolume && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-xl p-3 shadow-lg z-10 w-40"
              >
                <Slider
                  value={[volume]}
                  onValueChange={([v]) => setVolume(v)}
                  min={0} max={100} step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground text-center mt-1">{volume}%</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mute */}
        <button
          onClick={() => {
            const next = !muted;
            setMuted(next);
            mediaStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
          }}
          className={cn(
            "p-3 rounded-full transition-colors",
            muted ? "bg-destructive text-destructive-foreground" : "bg-white/10 hover:bg-white/20 text-white"
          )}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Reconnect */}
        {(status === "error" || status === "reconnecting") && (
          <button
            onClick={manualReconnect}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            aria-label="Reconnect"
          >
            <WifiOff className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
