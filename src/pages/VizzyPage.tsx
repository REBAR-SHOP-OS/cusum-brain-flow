import { useState, useCallback, useRef, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { X, Mic, MicOff, Volume2, WifiOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { buildVizzyContext } from "@/lib/vizzyContext";
import type { VizzyBusinessSnapshot } from "@/types/vizzy";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const CONTEXT_CACHE_KEY = "vizzy_context_cache";
const CONTEXT_CACHE_TTL = 5 * 60 * 1000;

interface TranscriptEntry {
  role: "user" | "agent";
  text: string;
  id: string;
}

export default function VizzyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showVolume, setShowVolume] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const snapshotRef = useRef<VizzyBusinessSnapshot | null>(null);
  const languageRef = useRef("en");
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Admin guard
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

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Session timer
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
      const firstUserMsg = entries.find((e) => e.role === "user")?.text || "Voice Chat";
      const title = firstUserMsg.slice(0, 80) + (firstUserMsg.length > 80 ? "..." : "");
      const { data: session } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title: `🎙️ ${title}`,
          agent_name: "Vizzy",
          agent_color: "bg-yellow-400",
        })
        .select("id")
        .single();
      if (session) {
        await supabase.from("chat_messages").insert(
          entries.filter((e) => e.text.trim()).map((e) => ({
            session_id: session.id,
            role: e.role,
            content: e.text,
            agent_type: "assistant",
          }))
        );
      }
    } catch (err) {
      console.error("Failed to save transcript:", err);
    }
  }, [user]);

  const loadContext = useCallback(async (): Promise<VizzyBusinessSnapshot | null> => {
    try {
      const cached = sessionStorage.getItem(CONTEXT_CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CONTEXT_CACHE_TTL) return data;
      }
    } catch {}
    try {
      const { data, error } = await supabase.functions.invoke("vizzy-context");
      if (error || !data?.snapshot) return null;
      const snap = data.snapshot as VizzyBusinessSnapshot;
      try { sessionStorage.setItem(CONTEXT_CACHE_KEY, JSON.stringify({ data: snap, ts: Date.now() })); } catch {}
      return snap;
    } catch { return null; }
  }, []);

  // ElevenLabs conversation hook
  const conversation = useConversation({
    micMuted: muted,
    onConnect: () => {
      setStatus("connected");
    },
    onDisconnect: () => {
      if (intentionalStopRef.current) {
        saveTranscript(transcriptRef.current);
        navigate("/home");
        return;
      }
      // Unintentional disconnect — show error with reconnect button
      saveTranscript(transcriptRef.current);
      setStatus("error");
      setErrorMsg("Disconnected from Vizzy");
    },
    onMessage: (message: any) => {
      if (message.type === "user_transcript") {
        const text = message.user_transcription_event?.user_transcript ?? "";
        const entry: TranscriptEntry = { role: "user", text, id: crypto.randomUUID() };
        setTranscript((prev) => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
      } else if (message.type === "agent_response") {
        const text = message.agent_response_event?.agent_response ?? "";
        const entry: TranscriptEntry = { role: "agent", text, id: crypto.randomUUID() };
        setTranscript((prev) => { const next = [...prev, entry]; transcriptRef.current = next; return next; });
      }
    },
    onError: (error: any) => {
      try { console.warn("Vizzy voice error:", error?.message || error); } catch {}
    },
  });

  // Volume sync
  useEffect(() => {
    try { conversation.setVolume({ volume: volume / 100 }); } catch {}
  }, [volume, conversation]);

  // Connect function
  const connect = useCallback(async () => {
    if (status === "connecting") return;
    setStatus("connecting");
    setErrorMsg("");
    setTranscript([]);
    transcriptRef.current = [];
    setElapsed(0);
    intentionalStopRef.current = false;

    try {
      // Request mic
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Fetch token
      const { data, error } = await supabase.functions.invoke("elevenlabs-conversation-token");
      if (error || !data?.signed_url) throw new Error("Failed to get voice session token");

      languageRef.current = data.preferred_language ?? "en";

      // Connect via WebSocket only
      await conversation.startSession({
        signedUrl: data.signed_url,
        connectionType: "websocket",
      });

      // Wait for stabilization then push context
      await new Promise((r) => setTimeout(r, 2000));

      const snap = await loadContext();
      if (snap) {
        snapshotRef.current = snap;
        conversation.sendContextualUpdate(buildVizzyContext(snap, languageRef.current));
      }
    } catch (err) {
      console.error("Connection failed:", err);
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Connection failed");
    }
  }, [status, conversation, loadContext]);

  // Auto-start on mount
  useEffect(() => {
    if (isAdmin && !startedRef.current) {
      startedRef.current = true;
      connect();
    }
  }, [isAdmin, connect]);

  // Close handler
  const handleClose = useCallback(async () => {
    intentionalStopRef.current = true;
    try { await conversation.endSession(); } catch {}
    saveTranscript(transcriptRef.current);
    navigate("/home");
  }, [conversation, navigate, saveTranscript]);

  if (isAdmin === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
        <div className="text-white/60 text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 backdrop-blur-sm">
      {/* Top bar */}
      <div className="w-full flex items-center justify-between px-6 pt-6">
        <div className="text-white/60 font-mono text-sm">
          {status === "connected" && formatTime(elapsed)}
        </div>
        <Button variant="ghost" size="icon" onClick={handleClose} className="text-white/60 hover:text-white">
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Center: Avatar + Status */}
      <div className="flex flex-col items-center gap-6">
        <motion.div
          className={cn(
            "w-28 h-28 rounded-full flex items-center justify-center text-5xl",
            status === "connected"
              ? "bg-yellow-500/20 shadow-[0_0_40px_rgba(234,179,8,0.3)]"
              : "bg-white/10"
          )}
          animate={
            status === "connected" && conversation.isSpeaking
              ? { scale: [1, 1.08, 1], transition: { repeat: Infinity, duration: 1.5 } }
              : { scale: 1 }
          }
        >
          🧠
        </motion.div>

        <div className="text-center">
          <h2 className="text-white text-xl font-semibold">Vizzy</h2>
          <p className={cn("text-sm mt-1", {
            "text-white/40": status === "idle",
            "text-yellow-400": status === "connecting",
            "text-emerald-400": status === "connected",
            "text-red-400": status === "error",
          })}>
            {status === "idle" && "Ready"}
            {status === "connecting" && "Connecting..."}
            {status === "connected" && (conversation.isSpeaking ? "Speaking..." : "Listening...")}
            {status === "error" && (errorMsg || "Connection lost")}
          </p>
        </div>

        {/* Reconnect button when error */}
        {status === "error" && (
          <Button
            onClick={() => { startedRef.current = false; setStatus("idle"); setTimeout(() => { startedRef.current = true; connect(); }, 100); }}
            variant="outline"
            className="gap-2 border-white/20 text-white hover:bg-white/10"
          >
            <RefreshCw className="w-4 h-4" /> Reconnect
          </Button>
        )}
      </div>

      {/* Transcript + Controls */}
      <div className="w-full max-w-lg px-4 pb-6 flex flex-col gap-4">
        {/* Transcript */}
        {transcript.length > 0 && (
          <ScrollArea className="h-48 rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="space-y-3">
              {transcript.map((entry) => (
                <div key={entry.id} className={cn("text-sm", entry.role === "user" ? "text-blue-300" : "text-white/80")}>
                  <span className="font-medium text-white/40 text-xs mr-2">
                    {entry.role === "user" ? "You" : "Vizzy"}
                  </span>
                  {entry.text}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </ScrollArea>
        )}

        {/* Controls bar */}
        <div className="flex items-center justify-center gap-4">
          {/* Volume */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowVolume(!showVolume)}
              className="text-white/60 hover:text-white"
            >
              <Volume2 className="w-5 h-5" />
            </Button>
            {showVolume && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 rounded-lg p-3 w-36">
                <Slider
                  value={[volume]}
                  onValueChange={(v) => setVolume(v[0])}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* Mute */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMuted(!muted)}
            className={cn(
              "w-14 h-14 rounded-full",
              muted ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white"
            )}
          >
            {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </Button>

          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white/60 hover:text-red-400"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
