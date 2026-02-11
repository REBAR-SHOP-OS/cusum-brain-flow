import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { X, ArrowLeft, Mic, MicOff, Volume2, WifiOff, Phone, Send, FileText, Check, XCircle } from "lucide-react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const intentionalStopRef = useRef(false);
  const retryCountRef = useRef(0);
  const snapshotRef = useRef<VizzyBusinessSnapshot | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { loadFullContext } = useVizzyContext();

  // Session timer
  useEffect(() => {
    if (status === "connected" && !timerRef.current) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
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
      .filter((e) => e.type !== "quotation")
      .slice(-20)
      .map((e) => `${e.role === "user" ? "CEO" : "Vizzy"}: ${e.text}`)
      .join("\n");
    return `\n═══ CONVERSATION MEMORY (session was interrupted, continuing) ═══\nThe following is what was discussed before the interruption. Continue naturally from where you left off. Do NOT greet the CEO again or repeat yourself.\n\n${lines}\n\n═══ END CONVERSATION MEMORY ═══`;
  }, []);

  const reconnectRef = useRef<() => void>(() => {});

  const addQuotationCard = useCallback((draft: QuotationDraft) => {
    const entry: TranscriptEntry = {
      role: "agent",
      text: `Quotation draft for ${draft.customerName}`,
      id: crypto.randomUUID(),
      type: "quotation",
      quotation: draft,
    };
    setTranscript((prev) => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
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
        const entry: TranscriptEntry = {
          role: "user",
          text: message.user_transcription_event?.user_transcript ?? "",
          id: crypto.randomUUID(),
          type: "text",
        };
        setTranscript((prev) => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
      } else if (message.type === "agent_response") {
        const entry: TranscriptEntry = {
          role: "agent",
          text: message.agent_response_event?.agent_response ?? "",
          id: crypto.randomUUID(),
          type: "text",
        };
        setTranscript((prev) => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
      }
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
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

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/home")}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center ring-2 transition-all",
              conversation.isSpeaking ? "ring-primary shadow-lg" : "ring-primary/30"
            )}>
              <span className="text-lg">🧠</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Vizzy</h1>
              <p className="text-xs text-muted-foreground">
                {status === "starting" && "Connecting..."}
                {status === "reconnecting" && "Reconnecting..."}
                {status === "error" && "Disconnected"}
                {status === "connected" && (conversation.isSpeaking ? "Speaking" : "Listening")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Timer */}
          {status === "connected" && (
            <span className="text-xs tabular-nums text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
              {formatTime(elapsed)}
            </span>
          )}

          {/* Volume */}
          <div className="relative">
            <button
              onClick={() => setShowVolume(!showVolume)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Volume"
            >
              <Volume2 className="w-4 h-4 text-foreground" />
            </button>
            <AnimatePresence>
              {showVolume && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg p-3 shadow-lg z-10 w-40"
                >
                  <Slider
                    value={[volume]}
                    onValueChange={([v]) => setVolume(v)}
                    min={0}
                    max={100}
                    step={5}
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
              "p-2 rounded-lg transition-colors",
              muted ? "bg-destructive/20 text-destructive" : "hover:bg-muted text-foreground"
            )}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Reconnect */}
          {(status === "error" || status === "reconnecting") && (
            <button
              onClick={manualReconnect}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-foreground"
              aria-label="Reconnect"
            >
              <WifiOff className="w-4 h-4" />
            </button>
          )}

          {/* End */}
          {(status === "connected" || status === "reconnecting") && (
            <button
              onClick={stop}
              className="p-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
              aria-label="End"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Voice activity indicator */}
      {status === "connected" && (
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            animate={{
              scaleX: conversation.isSpeaking ? [0.3, 1, 0.3] : muted ? 0 : 0.1,
              opacity: conversation.isSpeaking ? 1 : 0.4,
            }}
            transition={{ duration: conversation.isSpeaking ? 0.8 : 0.3, repeat: conversation.isSpeaking ? Infinity : 0 }}
            style={{ transformOrigin: "left" }}
          />
        </div>
      )}

      {/* Chat transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {transcript.length === 0 && status === "connected" && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <span className="text-4xl mb-3">🧠</span>
            <p className="text-sm">Vizzy is listening. Start talking...</p>
          </div>
        )}

        {transcript.map((entry) => {
          // Quotation card
          if (entry.type === "quotation" && entry.quotation) {
            const q = entry.quotation;
            const subtotal = q.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
            return (
              <div key={entry.id} className="mr-auto max-w-[90%]">
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Quotation Draft</span>
                    <span className={cn(
                      "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium",
                      q.status === "draft" && "bg-amber-500/20 text-amber-600",
                      q.status === "approved" && "bg-emerald-500/20 text-emerald-600",
                      q.status === "dismissed" && "bg-destructive/20 text-destructive",
                    )}>
                      {q.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Customer:</span> <span className="font-medium text-foreground">{q.customerName}</span></p>
                    {q.projectName && <p><span className="text-muted-foreground">Project:</span> <span className="text-foreground">{q.projectName}</span></p>}
                  </div>
                  <div className="mt-3 border-t border-border pt-2">
                    {q.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs py-1">
                        <span className="text-foreground">{item.description}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {item.quantity} × ${item.unitPrice.toFixed(2)} = ${(item.quantity * item.unitPrice).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border mt-2">
                      <span className="text-foreground">Total</span>
                      <span className="text-foreground tabular-nums">${subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                  {q.notes && <p className="text-xs text-muted-foreground mt-2 italic">{q.notes}</p>}
                  {q.status === "draft" && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="gap-1 h-8 text-xs"
                        onClick={() => updateQuotationStatus(entry.id, "approved")}
                      >
                        <Check className="w-3 h-3" /> Approve & Send
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-8 text-xs"
                        onClick={() => updateQuotationStatus(entry.id, "dismissed")}
                      >
                        <XCircle className="w-3 h-3" /> Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Regular message
          return (
            <div
              key={entry.id}
              className={cn(
                "max-w-[80%]",
                entry.role === "user" ? "ml-auto" : "mr-auto"
              )}
            >
              <div className={cn(
                "px-4 py-2.5 rounded-2xl text-sm",
                entry.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              )}>
                {entry.text}
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 block px-1">
                {entry.role === "user" ? "You" : "Vizzy"}
              </span>
            </div>
          );
        })}

        {/* Reconnecting indicator */}
        {status === "reconnecting" && (
          <div className="mr-auto">
            <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-md">
              <motion.div
                className="flex gap-1"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div className="w-2 h-2 rounded-full bg-primary" />
              </motion.div>
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 block px-1">Reconnecting...</span>
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="px-4 py-3 border-t border-border bg-card">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {status === "starting" && (
            <>
              <motion.div
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span>Connecting to Vizzy...</span>
            </>
          )}
          {status === "connected" && (
            <>
              <div className={cn(
                "w-2 h-2 rounded-full",
                muted ? "bg-destructive" : "bg-emerald-500"
              )} />
              <span>{muted ? "Microphone muted" : "Voice session active"}</span>
            </>
          )}
          {status === "error" && (
            <>
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span>Connection lost</span>
              <button onClick={manualReconnect} className="text-primary hover:underline text-xs ml-2">
                Retry
              </button>
            </>
          )}
          {status === "reconnecting" && (
            <>
              <motion.div
                className="w-2 h-2 rounded-full bg-amber-500"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span>Reconnecting...</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
