import { useState, useRef } from "react";
import { Mic, MicOff, Copy, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { toast } from "sonner";

type WidgetStatus = "idle" | "listening" | "processing" | "result";

export function VoiceRecorderWidget() {
  const [status, setStatus] = useState<WidgetStatus>("idle");
  const [originalText, setOriginalText] = useState("");
  const [englishText, setEnglishText] = useState("");
  const [detectedLang, setDetectedLang] = useState("");
  const capturedTextRef = useRef("");

  const speech = useSpeechRecognition({
    onError: (err) => toast.error(err),
  });

  const handleStart = () => {
    setOriginalText("");
    setEnglishText("");
    setDetectedLang("");
    capturedTextRef.current = "";
    speech.reset();
    speech.start();
    setStatus("listening");
  };

  const handleStop = async () => {
    speech.stop();
    const text = (speech.fullTranscript + " " + speech.interimText).trim();
    capturedTextRef.current = text;
    setOriginalText(text);

    if (!text) {
      toast.error("No speech detected. Try again.");
      setStatus("idle");
      return;
    }

    setStatus("processing");

    try {
      const { data, error } = await supabase.functions.invoke("transcribe-translate", {
        body: { mode: "text", text, sourceLang: "auto" },
      });

      if (error) throw error;

      setEnglishText(data?.english || text);
      setDetectedLang(data?.detectedLang || "unknown");
      setStatus("result");
    } catch (e) {
      console.error("Translation error:", e);
      toast.error("Translation failed. Please try again.");
      setStatus("idle");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(englishText);
    toast.success("Copied to clipboard");
  };

  const handleDismiss = () => {
    setStatus("idle");
    setOriginalText("");
    setEnglishText("");
    setDetectedLang("");
    speech.reset();
  };

  const liveText = speech.fullTranscript + (speech.interimText ? " " + speech.interimText : "");

  if (status === "idle") {
    return (
      <button
        onClick={handleStart}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground shadow-[0_0_30px_-5px_hsl(var(--primary)/0.5)] flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="Voice memo"
      >
        <Mic className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-border/60 bg-card/80 backdrop-blur-md shadow-[0_0_40px_-10px_hsl(var(--primary)/0.3)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          {status === "listening" && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
            </span>
          )}
          {status === "processing" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
          <span className="text-xs font-bold tracking-wider text-foreground uppercase">
            {status === "listening" ? "Listening…" : status === "processing" ? "Translating…" : "Translation"}
          </span>
          {detectedLang && (
            <span className="text-[9px] tracking-widest text-primary/70 uppercase">{detectedLang}</span>
          )}
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
        {status === "listening" && (
          <>
            {/* Pulse animation */}
            <div className="flex items-center justify-center gap-1 py-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full animate-pulse"
                  style={{
                    height: `${12 + Math.random() * 20}px`,
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: "0.6s",
                  }}
                />
              ))}
            </div>
            {liveText && (
              <p className="text-xs text-muted-foreground italic leading-relaxed">{liveText}</p>
            )}
            <button
              onClick={handleStop}
              className="w-full py-2 rounded-lg bg-destructive/90 hover:bg-destructive text-destructive-foreground text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-2"
            >
              <MicOff className="w-4 h-4" /> Stop
            </button>
          </>
        )}

        {status === "processing" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
            <p className="text-[10px] tracking-widest text-muted-foreground uppercase">AI Processing</p>
          </div>
        )}

        {status === "result" && (
          <>
            {originalText && (
              <div>
                <p className="text-[9px] tracking-widest text-muted-foreground uppercase mb-1">Original</p>
                <p className="text-xs text-foreground/70 leading-relaxed">{originalText}</p>
              </div>
            )}
            <div>
              <p className="text-[9px] tracking-widest text-primary/70 uppercase mb-1">English</p>
              <p className="text-sm text-foreground leading-relaxed font-medium">{englishText}</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCopy}
                className="flex-1 py-2 rounded-lg border border-border/60 hover:bg-muted/50 text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 text-foreground"
              >
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              <button
                onClick={handleStart}
                className="flex-1 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5"
              >
                <Mic className="w-3.5 h-3.5" /> Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
