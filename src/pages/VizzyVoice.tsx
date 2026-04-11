import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Send, Volume2, Loader2, Settings, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Status = "idle" | "listening" | "processing" | "speaking";

const STATUS_LABELS: Record<Status, string> = {
  idle: "Tap the mic to speak",
  listening: "Listening…",
  processing: "Thinking…",
  speaking: "Speaking…",
};

const LS_VOICE = "vizzy-voice-uri";
const LS_RATE = "vizzy-rate";
const LS_PITCH = "vizzy-pitch";

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let s = 0;
  if (/natural|enhanced|premium/.test(name)) s += 10;
  if (/google/.test(name)) s += 5;
  if (!v.localService) s += 3;
  return s;
}

function pickBestVoice(voices: SpeechSynthesisVoice[], savedURI: string | null): string {
  if (savedURI && voices.some((v) => v.voiceURI === savedURI)) return savedURI;
  const en = voices.filter((v) => v.lang.startsWith("en"));
  if (en.length) {
    en.sort((a, b) => scoreVoice(b) - scoreVoice(a));
    return en[0].voiceURI;
  }
  return voices[0]?.voiceURI ?? "";
}

export default function VizzyVoice() {
  const [status, setStatus] = useState<Status>("idle");
  const [userText, setUserText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [typedInput, setTypedInput] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Voice settings
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const [rate, setRate] = useState(() => parseFloat(localStorage.getItem(LS_RATE) ?? "0.95"));
  const [pitch, setPitch] = useState(() => parseFloat(localStorage.getItem(LS_PITCH) ?? "1.05"));
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const v = speechSynthesis.getVoices();
      if (!v.length) return;
      setVoices(v);
      const saved = localStorage.getItem(LS_VOICE);
      const best = pickBestVoice(v, saved);
      setSelectedVoiceURI(best);
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { speechSynthesis.onvoiceschanged = null; };
  }, []);

  // Persist settings
  useEffect(() => { if (selectedVoiceURI) localStorage.setItem(LS_VOICE, selectedVoiceURI); }, [selectedVoiceURI]);
  useEffect(() => { localStorage.setItem(LS_RATE, String(rate)); }, [rate]);
  useEffect(() => { localStorage.setItem(LS_PITCH, String(pitch)); }, [pitch]);

  const getVoice = useCallback(() => voices.find((v) => v.voiceURI === selectedVoiceURI) ?? null, [voices, selectedVoiceURI]);

  const speakText = useCallback((text: string, onEnd?: () => void) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = getVoice();
    utter.voice = voice;
    if (voice) utter.lang = voice.lang;
    utter.rate = rate;
    utter.pitch = pitch;
    utter.onstart = () => setStatus("speaking");
    utter.onend = () => { setStatus("idle"); onEnd?.(); };
    utter.onerror = () => { setStatus("idle"); onEnd?.(); };
    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [getVoice, rate, pitch]);

  const SpeechRecognitionAPI =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  const isSupported = !!SpeechRecognitionAPI;

  const sendToVizzy = useCallback(async (text: string) => {
    setError("");
    setUserText(text);
    setReplyText("");
    setStatus("processing");
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vizzy-voice`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ text, source: "vizzy-voice-ui" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Request failed");
      const reply = data.reply || "No reply received.";
      setReplyText(reply);
      if ("speechSynthesis" in window) {
        speakText(reply);
      } else {
        setStatus("idle");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setStatus("idle");
    }
  }, [speakText]);

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
    window.speechSynthesis?.cancel();
    // Prime speechSynthesis during user gesture for mobile
    const primer = new SpeechSynthesisUtterance("");
    primer.volume = 0;
    window.speechSynthesis.speak(primer);
    if (status === "listening") stopListening();
    else if (status === "idle") startListening();
  }, [status, startListening, stopListening]);

  const handleTypedSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const t = typedInput.trim();
    if (!t) return;
    // Prime speechSynthesis during submit gesture
    const primer = new SpeechSynthesisUtterance("");
    primer.volume = 0;
    window.speechSynthesis.speak(primer);
    setTypedInput("");
    sendToVizzy(t);
  }, [typedInput, sendToVizzy]);

  const testSpeak = useCallback(() => {
    speakText("Hello, I'm Vizzy, your rebar shop assistant.");
  }, [speakText]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); };
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

      {/* Voice Settings */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="mt-6 w-full max-w-md">
        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest font-semibold">
          <Settings className="w-3.5 h-3.5" />
          Voice Settings
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-4 rounded-lg border border-border bg-muted/20 p-4">
          {/* Voice select */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Voice</label>
            <select
              value={selectedVoiceURI}
              onChange={(e) => setSelectedVoiceURI(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          {/* Rate */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Speed: {rate.toFixed(2)}</label>
            <Slider min={0.5} max={1.5} step={0.05} value={[rate]} onValueChange={([v]) => setRate(v)} />
          </div>

          {/* Pitch */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Pitch: {pitch.toFixed(2)}</label>
            <Slider min={0.5} max={1.5} step={0.05} value={[pitch]} onValueChange={([v]) => setPitch(v)} />
          </div>

          {/* Test */}
          <button onClick={testSpeak} disabled={busy} className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40">
            <Play className="w-3 h-3" /> Test Voice
          </button>
        </CollapsibleContent>
      </Collapsible>

      {!isSupported && <p className="mt-4 text-xs text-destructive">Speech recognition not supported in this browser. Use the text input instead.</p>}
      <p className="mt-8 text-[10px] text-muted-foreground">Internal tool · v1</p>
    </div>
  );
}
