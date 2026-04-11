import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Send, Volume2, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { createPrimedAudio, swapAndPlay } from "@/lib/audioPlayer";

type Status = "idle" | "listening" | "processing" | "speaking";

const STATUS_LABELS: Record<Status, string> = {
  idle: "Tap the mic to speak",
  listening: "Listening…",
  processing: "Thinking…",
  speaking: "Speaking…",
};

/** Default ElevenLabs voice – Sarah (warm, natural English) */
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

/**
 * Call the elevenlabs-tts edge function and return an audio Blob.
 * Uses the anon key so no user login is required on this page.
 */
async function fetchTTSBlob(text: string): Promise<Blob> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ text, voiceId: DEFAULT_VOICE_ID }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`TTS failed (${resp.status}): ${errText}`);
  }
  return resp.blob();
}

export default function VizzyVoice() {
  const [status, setStatus] = useState<Status>("idle");
  const [userText, setUserText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [typedInput, setTypedInput] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<any>(null);
  /** Audio element primed during user gesture for mobile-safe playback */
  const primedAudioRef = useRef<HTMLAudioElement | null>(null);

  const SpeechRecognitionAPI =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  const isSupported = !!SpeechRecognitionAPI;

  /** Prime an audio element during the current user gesture */
  const primeAudio = useCallback(() => {
    primedAudioRef.current = createPrimedAudio();
  }, []);

  /** Play TTS blob through the primed audio element */
  const playTTS = useCallback(async (text: string) => {
    setStatus("speaking");
    try {
      const blob = await fetchTTSBlob(text);
      // Guard against empty / corrupt blobs
      if (!blob || blob.size < 1000) {
        console.warn("[VizzyVoice] TTS blob too small:", blob?.size);
        setStatus("idle");
        return;
      }
      const audio = primedAudioRef.current || createPrimedAudio();
      await swapAndPlay(audio, blob);
    } catch (err: any) {
      console.error("[VizzyVoice] TTS playback error:", err);
    } finally {
      setStatus("idle");
    }
  }, []);

  const sendToVizzy = useCallback(async (text: string) => {
    setError("");
    setUserText(text);
    setReplyText("");
    setStatus("processing");
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vizzy-voice`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ text, source: "vizzy-voice-ui" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Request failed");
      const reply = data.reply || "No reply received.";
      setReplyText(reply);
      await playTTS(reply);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setStatus("idle");
    }
  }, [playTTS]);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    setError("");
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setStatus("listening");
    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) sendToVizzy(transcript); else setStatus("idle");
    };
    recognition.onerror = (event: any) => {
      if (event.error === "aborted") return;
      setError(`Mic error: ${event.error}`);
      setStatus("idle");
    };
    recognition.onend = () => setStatus((s) => (s === "listening" ? "idle" : s));
    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognitionAPI, sendToVizzy]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setStatus("idle");
  }, []);

  const toggleMic = useCallback(() => {
    // Prime audio element during this user gesture (mobile-safe)
    primeAudio();
    if (status === "listening") stopListening();
    else if (status === "idle") startListening();
  }, [status, startListening, stopListening, primeAudio]);

  const handleTypedSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const t = typedInput.trim();
    if (!t) return;
    primeAudio();
    setTypedInput("");
    sendToVizzy(t);
  }, [typedInput, sendToVizzy, primeAudio]);

  const testSpeak = useCallback(() => {
    primeAudio();
    playTTS("Hello, I'm Vizzy, your rebar shop assistant. How can I help you today?");
  }, [primeAudio, playTTS]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  const micActive = status === "listening";
  const busy = status === "processing" || status === "speaking";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 selection:bg-primary/20">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black tracking-tight">VIZZY VOICE</h1>
        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-semibold">Rebar Shop Assistant</p>
      </div>

      {/* Mic Button */}
      <button
        onClick={toggleMic}
        disabled={busy || !isSupported}
        className={cn(
          "relative w-32 h-32 rounded-full flex items-center justify-center transition-all focus:outline-none border-4",
          micActive ? "bg-destructive/15 border-destructive text-destructive"
            : busy ? "bg-muted border-border text-muted-foreground cursor-wait"
            : "bg-primary/10 border-primary text-primary hover:bg-primary/20 active:scale-95"
        )}
      >
        <AnimatePresence>
          {micActive && (
            <>
              <motion.div className="absolute inset-0 rounded-full border-2 border-destructive/40" initial={{ scale: 1, opacity: 0.5 }} animate={{ scale: 1.3, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }} />
              <motion.div className="absolute inset-0 rounded-full border-2 border-destructive/30" initial={{ scale: 1, opacity: 0.4 }} animate={{ scale: 1.5, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.3 }} />
            </>
          )}
        </AnimatePresence>
        {status === "processing" ? <Loader2 className="w-12 h-12 animate-spin" /> : status === "speaking" ? <Volume2 className="w-12 h-12 animate-pulse" /> : micActive ? <MicOff className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
      </button>

      <p className={cn("mt-4 text-sm font-semibold uppercase tracking-wider", micActive ? "text-destructive" : "text-muted-foreground")}>{STATUS_LABELS[status]}</p>

      {error && <p className="mt-2 text-sm text-destructive font-medium">{error}</p>}

      {/* Transcript & Reply */}
      <div className="mt-8 w-full max-w-md space-y-3">
        {userText && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">You said</p>
            <p className="text-sm font-medium">{userText}</p>
          </div>
        )}
        {replyText && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-[10px] uppercase tracking-widest text-primary font-bold mb-1">Vizzy</p>
            <p className="text-sm font-medium">{replyText}</p>
          </div>
        )}
      </div>

      {/* Typed fallback */}
      <form onSubmit={handleTypedSubmit} className="mt-6 w-full max-w-md flex gap-2">
        <input
          type="text" value={typedInput} onChange={(e) => setTypedInput(e.target.value)}
          placeholder="Or type a question…" disabled={busy}
          className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button type="submit" disabled={busy || !typedInput.trim()} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Test Voice */}
      <button onClick={testSpeak} disabled={busy} className="mt-6 flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40">
        <Play className="w-3 h-3" /> Test Voice
      </button>

      {!isSupported && <p className="mt-4 text-xs text-destructive">Speech recognition not supported in this browser. Use the text input instead.</p>}
      <p className="mt-8 text-[10px] text-muted-foreground">Internal tool · v2 · ElevenLabs TTS</p>
    </div>
  );
}
