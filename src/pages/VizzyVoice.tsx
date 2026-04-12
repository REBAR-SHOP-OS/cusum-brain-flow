import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Send, Volume2, Loader2, Play, Copy, RotateCcw, AlertTriangle, CheckCircle2, Settings2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Status = "idle" | "listening" | "processing" | "speaking" | "error";

const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  idle: { label: "Tap the mic to speak", color: "text-muted-foreground" },
  listening: { label: "Listening…", color: "text-destructive" },
  processing: { label: "Thinking…", color: "text-primary" },
  speaking: { label: "Speaking…", color: "text-primary" },
  error: { label: "Error occurred", color: "text-destructive" },
};

const QUICK_ACTIONS = [
  "How many orders do we have?",
  "Latest orders",
  "How many customers do we have?",
  "How many leads do we have?",
  "How many machines do we have?",
  "How many cut plans do we have?",
];

function loadPref(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function savePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* noop */ }
}

export default function VizzyVoice() {
  const [status, setStatus] = useState<Status>("idle");
  const [userText, setUserText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [typedInput, setTypedInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [isUngrounded, setIsUngrounded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Voice settings
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => loadPref("vizzy-voice-uri", ""));
  const [rate, setRate] = useState(() => parseFloat(loadPref("vizzy-voice-rate", "0.95")));
  const [pitch, setPitch] = useState(() => parseFloat(loadPref("vizzy-voice-pitch", "1.05")));

  const recognitionRef = useRef<any>(null);
  const [replyTimestamp, setReplyTimestamp] = useState<Date | null>(null);

  const SpeechRecognitionAPI =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  const isSupported = !!SpeechRecognitionAPI;

  // Load voices and listen for changes
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices().filter(voice => voice.lang.startsWith("en"));
      setVoices(v);
      // Auto-select best voice if none persisted
      if (!selectedVoiceURI || !v.find(voice => voice.voiceURI === selectedVoiceURI)) {
        const best = v.find(voice => voice.name.includes("Natural"))
          || v.find(voice => voice.name.includes("Enhanced"))
          || v.find(voice => voice.name.includes("Google"))
          || v[0];
        if (best) {
          setSelectedVoiceURI(best.voiceURI);
          savePref("vizzy-voice-uri", best.voiceURI);
        }
      }
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [selectedVoiceURI]);

  const playTTS = useCallback(async (text: string) => {
    setStatus("speaking");
    return new Promise<void>((resolve) => {
      if (!window.speechSynthesis) { setStatus("idle"); resolve(); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
      if (voice) utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.onend = () => { setStatus("idle"); resolve(); };
      utterance.onerror = () => { setStatus("idle"); resolve(); };
      window.speechSynthesis.speak(utterance);
    });
  }, [voices, selectedVoiceURI, rate, pitch]);

  const sendToVizzy = useCallback(async (text: string) => {
    setErrorMsg("");
    setUserText(text);
    setReplyText("");
    setLastQuery(text);
    setIsUngrounded(false);
    setReplyTimestamp(null);
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
      const ungrounded = data.fallback === true || reply.includes("I don't have") || reply.includes("unavailable") || reply.includes("I'm not sure");
      setReplyText(reply);
      setReplyTimestamp(new Date());
      setIsUngrounded(ungrounded);
      await playTTS(reply);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
      setStatus("error");
    }
  }, [playTTS]);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) return;
    // Interrupt any ongoing speech
    window.speechSynthesis?.cancel();
    setErrorMsg("");
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
      setErrorMsg(`Mic error: ${event.error}`);
      setStatus("error");
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
    if (status === "speaking") {
      window.speechSynthesis?.cancel();
      setStatus("idle");
      return;
    }
    if (status === "listening") stopListening();
    else if (status === "idle" || status === "error") startListening();
  }, [status, startListening, stopListening]);

  const handleTypedSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const t = typedInput.trim();
    if (!t) return;
    setTypedInput("");
    sendToVizzy(t);
  }, [typedInput, sendToVizzy]);

  const testSpeak = useCallback(() => {
    playTTS("Hello, I'm Vizzy, your rebar shop assistant. How can I help you today?");
  }, [playTTS]);

  const retryLast = useCallback(() => {
    if (lastQuery) sendToVizzy(lastQuery);
  }, [lastQuery, sendToVizzy]);

  const copyReply = useCallback(() => {
    if (!replyText) return;
    navigator.clipboard.writeText(replyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [replyText]);

  useEffect(() => {
    return () => { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); };
  }, []);

  const busy = status === "processing" || status === "speaking";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center p-4 selection:bg-primary/20">
      {/* Header */}
      <div className="text-center mt-4 mb-2">
        <h1 className="text-3xl font-black tracking-tight">VIZZY</h1>
        <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-widest font-semibold">
          Rebar Shop Voice Assistant
        </p>
      </div>

      {/* Safety banner */}
      <div className="w-full max-w-md mb-4 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-center">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Answers from internal ERP data only · Read-only · No actions performed
        </p>
      </div>

      {/* Mic Button */}
      <button
        onClick={toggleMic}
        disabled={status === "processing"}
        className={cn(
          "relative w-28 h-28 rounded-full flex items-center justify-center transition-all focus:outline-none border-4",
          status === "listening" ? "bg-destructive/15 border-destructive text-destructive"
            : status === "speaking" ? "bg-primary/10 border-primary text-primary cursor-pointer"
            : busy ? "bg-muted border-border text-muted-foreground cursor-wait"
            : status === "error" ? "bg-destructive/10 border-destructive/50 text-destructive hover:bg-destructive/20"
            : "bg-primary/10 border-primary text-primary hover:bg-primary/20 active:scale-95"
        )}
      >
        <AnimatePresence>
          {status === "listening" && (
            <>
              <motion.div className="absolute inset-0 rounded-full border-2 border-destructive/40" initial={{ scale: 1, opacity: 0.5 }} animate={{ scale: 1.3, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }} />
              <motion.div className="absolute inset-0 rounded-full border-2 border-destructive/30" initial={{ scale: 1, opacity: 0.4 }} animate={{ scale: 1.5, opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.3 }} />
            </>
          )}
        </AnimatePresence>
        {status === "processing" ? <Loader2 className="w-10 h-10 animate-spin" />
          : status === "speaking" ? <Volume2 className="w-10 h-10 animate-pulse" />
          : status === "listening" ? <MicOff className="w-10 h-10" />
          : status === "error" ? <AlertTriangle className="w-10 h-10" />
          : <Mic className="w-10 h-10" />}
      </button>

      <p className={cn("mt-3 text-sm font-semibold uppercase tracking-wider", STATUS_CONFIG[status].color)}>
        {status === "error" && errorMsg ? errorMsg : STATUS_CONFIG[status].label}
      </p>

      {/* Quick Actions */}
      <div className="mt-4 w-full max-w-md flex flex-wrap gap-1.5 justify-center">
        {QUICK_ACTIONS.map((q) => (
          <button
            key={q}
            onClick={() => sendToVizzy(q)}
            disabled={busy}
            className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Transcript & Reply */}
      <div className="mt-5 w-full max-w-md space-y-3">
        {userText && (
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">You said</p>
            <p className="text-sm font-medium leading-relaxed">{userText}</p>
          </div>
        )}
        {replyText && (
          <div className={cn("rounded-lg border p-4", isUngrounded ? "border-yellow-500/40 bg-yellow-500/5" : "border-primary/30 bg-primary/5")}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <p className={cn("text-[10px] uppercase tracking-widest font-bold", isUngrounded ? "text-yellow-600" : "text-primary")}>
                  Vizzy
                </p>
                {isUngrounded && (
                  <span className="text-[9px] uppercase tracking-wider text-yellow-600 font-semibold bg-yellow-500/10 px-1.5 py-0.5 rounded">
                    Ungrounded
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {replyTimestamp && (
                  <span className="text-[9px] text-muted-foreground mr-1">
                    {replyTimestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
                <button onClick={copyReply} className="p-1 rounded hover:bg-muted transition-colors" title="Copy reply">
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              </div>
            </div>
            <p className="text-sm font-medium leading-relaxed">{replyText}</p>
          </div>
        )}
      </div>

      {/* Retry */}
      {lastQuery && (status === "idle" || status === "error") && (
        <button onClick={retryLast} className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RotateCcw className="w-3 h-3" /> Retry last query
        </button>
      )}

      {/* Typed fallback */}
      <form onSubmit={handleTypedSubmit} className="mt-5 w-full max-w-md flex gap-2">
        <input
          type="text" value={typedInput} onChange={(e) => setTypedInput(e.target.value)}
          placeholder="Or type a question…" disabled={busy}
          className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <Button type="submit" disabled={busy || !typedInput.trim()} size="icon" variant="default">
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {/* Voice Settings Collapsible */}
      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="mt-5 w-full max-w-md">
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mx-auto">
          <Settings2 className="w-3.5 h-3.5" />
          Voice Settings
          <ChevronDown className={cn("w-3 h-3 transition-transform", settingsOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 rounded-lg border border-border bg-muted/30 p-4 space-y-4">
          {/* Voice selector */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1 block">Voice</label>
            <Select
              value={selectedVoiceURI}
              onValueChange={(uri) => {
                setSelectedVoiceURI(uri);
                savePref("vizzy-voice-uri", uri);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select voice…" />
              </SelectTrigger>
              <SelectContent>
                {voices.map((v) => (
                  <SelectItem key={v.voiceURI} value={v.voiceURI} className="text-xs">
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rate slider */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Rate</label>
              <span className="text-[10px] text-muted-foreground font-mono">{rate.toFixed(2)}</span>
            </div>
            <Slider
              min={0.5} max={2} step={0.05}
              value={[rate]}
              onValueChange={([v]) => { setRate(v); savePref("vizzy-voice-rate", String(v)); }}
            />
          </div>

          {/* Pitch slider */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Pitch</label>
              <span className="text-[10px] text-muted-foreground font-mono">{pitch.toFixed(2)}</span>
            </div>
            <Slider
              min={0.5} max={1.5} step={0.05}
              value={[pitch]}
              onValueChange={([v]) => { setPitch(v); savePref("vizzy-voice-pitch", String(v)); }}
            />
          </div>

          {/* Test voice */}
          <Button onClick={testSpeak} disabled={busy} variant="outline" size="sm" className="w-full text-xs">
            <Play className="w-3 h-3 mr-1" /> Test Voice
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {!isSupported && <p className="mt-4 text-xs text-destructive">Speech recognition not supported. Use the text input.</p>}

      {/* Footer */}
      <p className="mt-8 mb-4 text-[10px] text-muted-foreground">Internal ERP Tool · Read-Only · PersonaPlex</p>
    </div>
  );
}
