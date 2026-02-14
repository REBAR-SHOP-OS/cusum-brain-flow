import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { X, Mic, MicOff, Volume2, WifiOff, Camera, Phone, PhoneOff, ChevronUp, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { buildVizzyContext } from "@/lib/vizzyContext";
import type { VizzyBusinessSnapshot } from "@/hooks/useVizzyContext";
import { useWebPhone } from "@/hooks/useWebPhone";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { FileText, Check, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

const MAX_RETRIES = 3;
const CONTEXT_CACHE_KEY = "vizzy_context_cache";
const CONTEXT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
  const [webPhoneState, webPhoneActions] = useWebPhone();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Role-based admin guard (replaces hardcoded email check)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!data) {
        navigate("/home", { replace: true });
      } else {
        setIsAdmin(true);
      }
    })();
  }, [user, navigate]);

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const [status, setStatus] = useState<"starting" | "connected" | "error" | "reconnecting">("starting");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showVolume, setShowVolume] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeQuotation, setActiveQuotation] = useState<{ id: string; draft: QuotationDraft } | null>(null);
  const [silentMode, setSilentMode] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const startedRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const intentionalStopRef = useRef(false);
  const retryCountRef = useRef(0);
  const snapshotRef = useRef<VizzyBusinessSnapshot | null>(null);
  const lastConnectTimeRef = useRef(0);
  const lastReconnectTimeRef = useRef(0);
  const useWebSocketFallbackRef = useRef(false);
  const cachedSignedUrlRef = useRef<string | null>(null);
  const autoFallbackAttemptedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const prevVolumeRef = useRef(80);
  const silentModeRef = useRef(false);
  const silentIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const webPhoneInitRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (showTranscript) {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript, showTranscript]);

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

  // Save transcript on page close/crash
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (transcriptRef.current.length > 0 && user) {
        // Use sendBeacon for reliability during page unload
        const payload = JSON.stringify({
          user_id: user.id,
          transcript: transcriptRef.current,
          session_ended_at: new Date().toISOString(),
        });
        navigator.sendBeacon(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/vizzy_interactions`,
          new Blob([payload], { type: "application/json" })
        );
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user]);

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

      if (sessionError || !session) return;

      const messagesToInsert = textEntries.map((entry) => ({
        session_id: session.id,
        role: entry.role === "user" ? "user" as const : "agent" as const,
        content: entry.text,
        agent_type: "assistant",
      }));

      await supabase.from("chat_messages").insert(messagesToInsert);
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

  // Load context with 5-minute sessionStorage cache
  const loadContextCached = useCallback(async (): Promise<VizzyBusinessSnapshot | null> => {
    try {
      const cached = sessionStorage.getItem(CONTEXT_CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CONTEXT_CACHE_TTL) {
          return data as VizzyBusinessSnapshot;
        }
      }
    } catch {}

    // Fetch fresh via server-side context builder
    try {
      const { data, error } = await supabase.functions.invoke("vizzy-context");
      if (error || !data?.snapshot) {
        console.warn("Server context failed, falling back to client:", error);
        // Fallback: import dynamically to avoid always loading the client hook
        const { useVizzyContext } = await import("@/hooks/useVizzyContext");
        // Can't use hooks outside React, just return null for fallback
        return null;
      }
      const snap = data.snapshot as VizzyBusinessSnapshot;
      try {
        sessionStorage.setItem(CONTEXT_CACHE_KEY, JSON.stringify({ data: snap, ts: Date.now() }));
      } catch {}
      return snap;
    } catch {
      return null;
    }
  }, []);

  const conversation = useConversation({
    micMuted: muted,
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
      make_call: async (params: { phone: string; contact_name?: string }) => {
        try {
          const wp = webPhoneInitRef.current;
          if (!wp) {
            const ok = await webPhoneActions.initialize();
            if (!ok) throw new Error("WebPhone not available. Check RingCentral connection.");
            webPhoneInitRef.current = true;
          }
          const success = await webPhoneActions.call(params.phone, params.contact_name);
          if (!success) throw new Error("Call failed to connect");
          return "Call initiated via browser WebRTC — audio is live in this browser session";
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error(`Call failed: ${msg}`);
          return `Call failed: ${msg}`;
        }
      },
      send_sms: async (params: { phone: string; message: string; contact_name?: string }) => {
        try {
          const { data, error } = await supabase.functions.invoke(
            "ringcentral-action",
            { body: { type: "ringcentral_sms", phone: params.phone, message: params.message, contact_name: params.contact_name } }
          );
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          toast.success(`SMS sent to ${params.contact_name || params.phone}`);
          return "SMS sent successfully";
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error(`SMS failed: ${msg}`);
          return `SMS failed: ${msg}`;
        }
      },
    },
    onConnect: () => {
      sessionActiveRef.current = true;
      lastConnectTimeRef.current = Date.now();
      autoFallbackAttemptedRef.current = false;
      setStatus("connected");
      retryCountRef.current = 0;
    },
    onDisconnect: () => {
      if (!sessionActiveRef.current) return;
      const sessionDuration = Date.now() - lastConnectTimeRef.current;
      sessionActiveRef.current = false;

      // Clear silent mode interval on disconnect (fix memory leak)
      if (silentIntervalRef.current) {
        clearInterval(silentIntervalRef.current);
        silentIntervalRef.current = null;
      }

      if (intentionalStopRef.current) {
        saveTranscript(transcriptRef.current);
        navigate("/home");
        return;
      }
      if (sessionDuration < 5000) {
        console.warn(`[Vizzy] Session lasted only ${sessionDuration}ms — agent-initiated disconnect`);
        useWebSocketFallbackRef.current = true;
        if (!autoFallbackAttemptedRef.current && cachedSignedUrlRef.current) {
          autoFallbackAttemptedRef.current = true;
          setStatus("reconnecting");
          setTimeout(() => reconnectRef.current(), 1000);
        } else {
          setStatus("error");
        }
        return;
      }
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        setStatus("reconnecting");
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 16000);
        setTimeout(() => reconnectRef.current(), delay);
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
          if (!silentIntervalRef.current) {
            silentIntervalRef.current = setInterval(() => {
              try { conversation.sendUserActivity(); } catch {}
            }, 15000);
          }
        } else if (shouldWake) {
          setSilentMode(false);
          silentModeRef.current = false;
          if (silentIntervalRef.current) { clearInterval(silentIntervalRef.current); silentIntervalRef.current = null; }
          try { conversation.setVolume({ volume: prevVolumeRef.current / 100 }); } catch {}
          conversation.sendContextualUpdate(
            "CEO called your name. You may speak again. Briefly summarize any notes you took during the silent period, then continue normally."
          );
        }
      } else if (message.type === "agent_response") {
        let agentText = message.agent_response_event?.agent_response ?? "";

        const actionMatch = agentText.match(/\[VIZZY-ACTION\]([\s\S]*?)\[\/VIZZY-ACTION\]/);
        if (actionMatch) {
          try {
            const actionData = JSON.parse(actionMatch[1]);
            (async () => {
              try {
                const { data, error } = await supabase.functions.invoke("ringcentral-action", { body: actionData });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);
                toast.success(actionData.type === "ringcentral_call" ? "Call initiated!" : "SMS sent!");
              } catch (err) {
                toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
              }
            })();
          } catch (e) {
            console.warn("Failed to parse vizzy-action:", e);
          }
          agentText = agentText.replace(/\[VIZZY-ACTION\][\s\S]*?\[\/VIZZY-ACTION\]/, "").trim();
        }

        const entry: TranscriptEntry = {
          role: "agent",
          text: agentText,
          id: crypto.randomUUID(),
          type: "text",
        };
        setTranscript((prev) => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
        if (silentModeRef.current) {
          conversation.sendContextualUpdate(
            "SYSTEM OVERRIDE: You are STILL in silent mode. Do NOT speak. Do NOT check in. Do NOT respond. Remain completely silent until CEO says 'Vizzy'."
          );
        }
      }
    },
    onError: (error: any) => {
      console.warn("Vizzy voice error (non-fatal):", error);
    },
  });

  // Volume control
  useEffect(() => {
    if (silentMode) return;
    try { conversation.setVolume({ volume: volume / 100 }); } catch {}
  }, [volume, conversation, silentMode]);

  useEffect(() => {
    reconnectRef.current = async () => {
      const timeSinceLastReconnect = Date.now() - lastReconnectTimeRef.current;
      if (timeSinceLastReconnect < 3000) return;
      lastReconnectTimeRef.current = Date.now();
      try {
        try { await conversation.endSession(); } catch {}
        await new Promise((r) => setTimeout(r, 500));

        const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token");
        if (error || !data?.token) throw new Error(error?.message ?? "No conversation token received");

        if (useWebSocketFallbackRef.current && data.signed_url) {
          await conversation.startSession({ signedUrl: data.signed_url, connectionType: "websocket" });
        } else {
          await conversation.startSession({ conversationToken: data.token, connectionType: "webrtc" });
        }

        await new Promise((r) => setTimeout(r, 2000));
        if (!sessionActiveRef.current) return;

        const snap = snapshotRef.current;
        if (snap) {
          conversation.sendContextualUpdate(buildVizzyContext(snap) + buildConversationMemory());
        }
        retryCountRef.current = 0;
      } catch (err) {
        console.error("Vizzy reconnect failed:", err);
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 16000);
          setTimeout(() => reconnectRef.current(), delay);
        } else {
          setStatus("error");
        }
      }
    };
  }, [conversation, buildConversationMemory]);

  const stop = useCallback(async () => {
    intentionalStopRef.current = true;
    webPhoneActions.dispose();
    try {
      await saveTranscript(transcriptRef.current);
      await conversation.endSession();
    } catch (err) {
      console.error("Error ending Vizzy session:", err);
    }
    navigate("/home");
  }, [conversation, navigate, saveTranscript, webPhoneActions]);

  const manualReconnect = useCallback(() => {
    retryCountRef.current = 0;
    setStatus("reconnecting");
    reconnectRef.current();
  }, []);

  // Auto-start on mount
  useEffect(() => {
    if (startedRef.current) return;
    if (!user || isAdmin === null) return;
    startedRef.current = true;

    (async () => {
      try {
        const [stream, tokenRes] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ audio: true }),
          supabase.functions.invoke("elevenlabs-conversation-token"),
        ]);
        mediaStreamRef.current = stream;

        if (tokenRes.error || !tokenRes.data?.token) {
          throw new Error(tokenRes.error?.message ?? "No conversation token received");
        }

        cachedSignedUrlRef.current = tokenRes.data.signed_url ?? null;
        await conversation.startSession({ conversationToken: tokenRes.data.token, connectionType: "webrtc" });

        webPhoneActions.initialize().then((ok) => {
          webPhoneInitRef.current = ok;
        });

        loadContextCached().then(async (snap) => {
          if (!snap) return;
          snapshotRef.current = snap;
          const rawContext = buildVizzyContext(snap);

          const waitForConnection = () => new Promise<void>((resolve) => {
            if (sessionActiveRef.current) return resolve();
            const check = setInterval(() => {
              if (sessionActiveRef.current) { clearInterval(check); resolve(); }
            }, 200);
            setTimeout(() => { clearInterval(check); resolve(); }, 10000);
          });
          await waitForConnection();
          await new Promise((r) => setTimeout(r, 2000));
          if (!sessionActiveRef.current) return;

          try {
            const { data: briefData } = await supabase.functions.invoke("vizzy-briefing", {
              body: { rawContext },
            });
            if (briefData?.briefing && sessionActiveRef.current) {
              conversation.sendContextualUpdate(briefData.briefing);
              return;
            }
          } catch (e) {
            console.warn("[Vizzy] Briefing failed, using raw context:", e);
          }

          if (sessionActiveRef.current) {
            conversation.sendContextualUpdate(rawContext);
          }
        });
      } catch (err) {
        console.error("Failed to start Vizzy voice:", err);
        setStatus("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, loadContextCached]);

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

  if (!user || isAdmin === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <p>Loading...</p>
      </div>
    );
  }

  const isSpeakingNow = conversation.isSpeaking;

  const statusLabel =
    webPhoneState.status === "calling" ? "Dialing..." :
    webPhoneState.status === "in_call" ? "On call" :
    status === "starting" ? "Connecting..." :
    status === "reconnecting" ? "Reconnecting..." :
    status === "error" ? "Connection lost" :
    silentMode ? "Silent mode — taking notes..." :
    isSpeakingNow ? "Vizzy is speaking..." : "Listening...";

  const textTranscript = transcript.filter((t) => t.type !== "quotation" && t.text.trim());

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
      {/* Close button */}
      <button
        onClick={stop}
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-destructive flex items-center justify-center hover:bg-destructive/80 transition-colors z-10"
        aria-label="Close"
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

      {/* Center avatar */}
      <div className="flex flex-col items-center gap-6">
        <motion.div
          className={cn(
            "w-32 h-32 rounded-full flex items-center justify-center",
            "bg-gradient-to-br from-primary/30 to-primary/10",
            "ring-4 transition-all duration-300",
            silentMode
              ? "ring-amber-500/50 opacity-60"
              : isSpeakingNow
              ? "ring-primary shadow-[0_0_60px_rgba(var(--primary),0.4)]"
              : status === "error"
              ? "ring-destructive/50"
              : "ring-white/20"
          )}
          animate={
            isSpeakingNow
              ? { scale: [1, 1.08, 1] }
              : status === "reconnecting"
              ? { opacity: [0.5, 1, 0.5] }
              : { scale: 1 }
          }
          transition={{
            duration: isSpeakingNow ? 1.5 : 2,
            repeat: isSpeakingNow || status === "reconnecting" ? Infinity : 0,
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

        {status === "error" && (
          <button onClick={manualReconnect} className="text-sm text-primary hover:underline">
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

      {/* Collapsible Transcript Panel */}
      <AnimatePresence>
        {showTranscript && textTranscript.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-20 inset-x-4 max-w-md mx-auto bg-card/95 backdrop-blur-lg border border-border rounded-2xl shadow-2xl z-10 max-h-[40vh]"
          >
            <ScrollArea className="h-full max-h-[40vh] p-4">
              <div className="space-y-3">
                {textTranscript.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "text-xs rounded-lg px-3 py-2 max-w-[85%]",
                      entry.role === "user"
                        ? "ml-auto bg-primary/20 text-primary-foreground"
                        : "mr-auto bg-muted text-foreground"
                    )}
                  >
                    <span className="font-semibold text-[10px] uppercase tracking-wide opacity-60 block mb-0.5">
                      {entry.role === "user" ? "You" : "Vizzy"}
                    </span>
                    {entry.text}
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom control bar */}
      <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-4 px-6">
        {/* Transcript toggle */}
        {textTranscript.length > 0 && (
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            aria-label="Toggle transcript"
          >
            {showTranscript ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>
        )}

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

        {/* Hangup WebRTC call */}
        {(webPhoneState.status === "calling" || webPhoneState.status === "in_call") && (
          <button
            onClick={() => webPhoneActions.hangup()}
            className="p-3 rounded-full bg-destructive hover:bg-destructive/80 transition-colors text-destructive-foreground"
            aria-label="Hang up"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        )}

        {/* Mute */}
        <button
          onClick={() => setMuted((prev) => !prev)}
          className={cn(
            "p-3 rounded-full transition-colors",
            muted 
              ? "bg-destructive text-destructive-foreground" 
              : "bg-white/10 hover:bg-white/20 text-white"
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
