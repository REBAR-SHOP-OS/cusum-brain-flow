import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Mic, MicOff, Upload, FileText, Copy, Download, Trash2, ChevronDown, ChevronUp, Loader2, Languages, RefreshCw, Timer, Users, Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "fa", label: "Farsi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "zh", label: "Chinese" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "ko", label: "Korean" },
  { value: "ja", label: "Japanese" },
  { value: "tr", label: "Turkish" },
  { value: "ur", label: "Urdu" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "vi", label: "Vietnamese" },
  { value: "th", label: "Thai" },
  { value: "id", label: "Indonesian" },
  { value: "ms", label: "Malay" },
  { value: "fil", label: "Filipino" },
  { value: "bn", label: "Bengali" },
  { value: "pa", label: "Punjabi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "sw", label: "Swahili" },
  { value: "he", label: "Hebrew" },
  { value: "el", label: "Greek" },
  { value: "cs", label: "Czech" },
];

const TARGET_LANGUAGES = [
  { value: "English", label: "English" },
  { value: "Spanish", label: "Spanish" },
  { value: "French", label: "French" },
  { value: "German", label: "German" },
  { value: "Portuguese", label: "Portuguese" },
  { value: "Italian", label: "Italian" },
  { value: "Dutch", label: "Dutch" },
  { value: "Russian", label: "Russian" },
  { value: "Chinese", label: "Chinese" },
  { value: "Japanese", label: "Japanese" },
  { value: "Korean", label: "Korean" },
  { value: "Arabic", label: "Arabic" },
  { value: "Hindi", label: "Hindi" },
  { value: "Farsi", label: "Farsi" },
  { value: "Turkish", label: "Turkish" },
  { value: "Polish", label: "Polish" },
  { value: "Vietnamese", label: "Vietnamese" },
  { value: "Thai", label: "Thai" },
  { value: "Indonesian", label: "Indonesian" },
  { value: "Malay", label: "Malay" },
  { value: "Bengali", label: "Bengali" },
  { value: "Urdu", label: "Urdu" },
  { value: "Swahili", label: "Swahili" },
  { value: "Hebrew", label: "Hebrew" },
  { value: "Greek", label: "Greek" },
  { value: "Czech", label: "Czech" },
];

interface HistoryEntry {
  id: string;
  original: string;
  english: string;
  detectedLang: string;
  mode: string;
  timestamp: Date;
  confidence?: number;
  speakers?: string[];
}

const SPEAKER_COLORS = [
  "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700",
  "text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700",
  "text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700",
  "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700",
  "text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700",
  "text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/40 border-cyan-300 dark:border-cyan-700",
];

function parseSpeakerLines(text: string): { speaker: string; content: string }[] {
  if (!text) return [];
  const lines = text.split("\n").filter(Boolean);
  return lines.map(line => {
    const match = line.match(/^(.+?):\s(.+)$/);
    if (match) return { speaker: match[1].trim(), content: match[2].trim() };
    return { speaker: "", content: line };
  });
}

function SpeakerTranscript({ text, speakers }: { text: string; speakers: string[] }) {
  const lines = useMemo(() => parseSpeakerLines(text), [text]);
  const hasSpeakers = speakers.length > 1 && lines.some(l => l.speaker);

  if (!hasSpeakers) {
    return <div className="text-sm whitespace-pre-wrap">{text}</div>;
  }

  const speakerColorMap: Record<string, string> = {};
  speakers.forEach((s, i) => {
    speakerColorMap[s] = SPEAKER_COLORS[i % SPEAKER_COLORS.length];
  });

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const color = speakerColorMap[line.speaker] || SPEAKER_COLORS[0];
        return line.speaker ? (
          <div key={i} className="flex gap-2 items-start">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 mt-0.5 ${color}`}>
              {line.speaker}
            </span>
            <span className="text-sm">{line.content}</span>
          </div>
        ) : (
          <div key={i} className="text-sm">{line.content}</div>
        );
      })}
    </div>
  );
}

function SpeakersBadge({ speakers }: { speakers: string[] }) {
  if (!speakers || speakers.length <= 1) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      <Users className="w-3 h-3" />
      {speakers.length} speakers: {speakers.join(", ")}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 90 ? "text-primary bg-primary/10 border-primary/30"
    : confidence >= 70 ? "text-accent-foreground bg-accent border-accent/30"
    : "text-destructive bg-destructive/10 border-destructive/30";
  const label = confidence >= 90 ? "High" : confidence >= 70 ? "Medium" : "Low";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${color}`}>
      {confidence}% {label}
    </span>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscribeView() {
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("English");
  const [formality, setFormality] = useState("neutral");
  const [contextHint, setContextHint] = useState("");
  const [outputFormat, setOutputFormat] = useState("plain");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Results
  const [originalText, setOriginalText] = useState("");
  const [englishText, setEnglishText] = useState("");
  const [detectedLang, setDetectedLang] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Mic - ref-based accumulation
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);
  const accumulatedTextRef = useRef("");
  const [wordCount, setWordCount] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopDisabledRef = useRef(false);

  // Text paste
  const [pasteText, setPasteText] = useState("");

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Recording timer
  useEffect(() => {
    if (isListening) {
      setRecordingTime(0);
      stopDisabledRef.current = true;
      setTimeout(() => { stopDisabledRef.current = false; }, 1000);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isListening]);

  const addToHistory = useCallback((entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    setHistory(prev => [{
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    }, ...prev].slice(0, 10));
  }, []);

  const callTranslateAPI = async (body: any, isFormData = false) => {
    setIsProcessing(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-translate`;
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      };
      if (!isFormData) {
        headers["Content-Type"] = "application/json";
      }

      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: isFormData ? body : JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      return await resp.json();
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Mic Tab ---
  const startListening = () => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    if (sourceLang !== "auto") {
      recognition.lang = sourceLang;
    }

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
      if (finalText) {
        accumulatedTextRef.current += (accumulatedTextRef.current ? " " : "") + finalText.trim();
        setOriginalText(accumulatedTextRef.current);
        const wc = accumulatedTextRef.current.split(/\s+/).filter(Boolean).length;
        setWordCount(wc);
        setInterimText("");
      }
      // Update live word count including interim
      if (interim) {
        const totalText = accumulatedTextRef.current + " " + interim;
        const wc = totalText.split(/\s+/).filter(Boolean).length;
        setWordCount(wc);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied");
        setIsListening(false);
      } else if (event.error === "no-speech") {
        toast.info("No speech detected, still listening…");
      } else {
        toast.error(`Speech error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      }
    };

    // Reset state
    accumulatedTextRef.current = "";
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setOriginalText("");
    setEnglishText("");
    setDetectedLang("");
    setConfidence(null);
    setInterimText("");
    setWordCount(0);
  };

  const stopListening = async () => {
    if (stopDisabledRef.current) return;

    const ref = recognitionRef.current;
    recognitionRef.current = null;
    ref?.stop();
    setIsListening(false);
    setInterimText("");

    // Grab full accumulated text from ref (no race conditions)
    const fullText = accumulatedTextRef.current.trim();
    if (!fullText) {
      toast.info("No speech captured");
      return;
    }

    setOriginalText(fullText);
    toast.info("Translating full transcript…");

    try {
      const result = await callTranslateAPI({
        mode: "text",
        text: fullText,
        sourceLang,
        targetLang,
        formality,
        context: contextHint,
        outputFormat,
      });
      setEnglishText(result.english || "");
      setDetectedLang(result.detectedLang || "");
      setConfidence(typeof result.confidence === "number" ? result.confidence : null);
      setSpeakers(Array.isArray(result.speakers) ? result.speakers : []);
      addToHistory({
        original: fullText,
        english: result.english || "",
        detectedLang: result.detectedLang || "",
        mode: "mic",
        confidence: result.confidence,
        speakers: result.speakers,
      });
      toast.success("Translation complete");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Re-translate button
  const handleRetranslate = async () => {
    const textToRetranslate = originalText.trim();
    if (!textToRetranslate) return;
    try {
      const result = await callTranslateAPI({
        mode: "text",
        text: textToRetranslate,
        sourceLang,
        targetLang,
        formality,
        context: contextHint,
        outputFormat,
      });
      setEnglishText(result.english || "");
      setDetectedLang(result.detectedLang || "");
      setConfidence(typeof result.confidence === "number" ? result.confidence : null);
      setSpeakers(Array.isArray(result.speakers) ? result.speakers : []);
      toast.success("Re-translation complete");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // --- Upload Tab ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleAudioFile = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Please upload an audio file (MP3, WAV, M4A)");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File too large (max 25MB)");
      return;
    }
    const formData = new FormData();
    formData.append("audio", file);
    formData.append("sourceLang", sourceLang);
    formData.append("targetLang", targetLang);
    formData.append("formality", formality);
    formData.append("context", contextHint);
    formData.append("outputFormat", outputFormat);

    try {
      const result = await callTranslateAPI(formData, true);
      setOriginalText(result.transcript || result.original || "");
      setEnglishText(result.english || "");
      setDetectedLang(result.detectedLang || "");
      setConfidence(typeof result.confidence === "number" ? result.confidence : null);
      setSpeakers(Array.isArray(result.speakers) ? result.speakers : []);
      addToHistory({
        original: result.transcript || result.original || "",
        english: result.english || "",
        detectedLang: result.detectedLang || "",
        mode: "upload",
        confidence: result.confidence,
        speakers: result.speakers,
      });
      toast.success("Transcription complete");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // --- Text Tab ---
  const handleTextTranslate = async () => {
    if (!pasteText.trim()) return;
    try {
      const result = await callTranslateAPI({
        mode: "text",
        text: pasteText,
        sourceLang,
        targetLang,
        formality,
        context: contextHint,
        outputFormat,
      });
      setOriginalText(result.original || pasteText);
      setEnglishText(result.english || "");
      setDetectedLang(result.detectedLang || "");
      setConfidence(typeof result.confidence === "number" ? result.confidence : null);
      setSpeakers(Array.isArray(result.speakers) ? result.speakers : []);
      addToHistory({
        original: result.original || pasteText,
        english: result.english || "",
        detectedLang: result.detectedLang || "",
        mode: "text",
        confidence: result.confidence,
        speakers: result.speakers,
      });
      toast.success("Translation complete");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // --- Actions ---
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const downloadTxt = () => {
    const content = `Original (${detectedLang}):\n${originalText}\n\nTranslation:\n${englishText}${confidence !== null ? `\n\nConfidence: ${confidence}%` : ""}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcription-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const LANG_TO_BCP47: Record<string, string> = {
    English: "en-US", Spanish: "es-ES", French: "fr-FR", German: "de-DE",
    Portuguese: "pt-BR", Italian: "it-IT", Dutch: "nl-NL", Russian: "ru-RU",
    Chinese: "zh-CN", Japanese: "ja-JP", Korean: "ko-KR", Arabic: "ar-SA",
    Hindi: "hi-IN", Farsi: "fa-IR", Turkish: "tr-TR", Polish: "pl-PL",
  };

  const playVoice = (text: string) => {
    if (!("speechSynthesis" in window)) {
      toast.error("Voice playback not supported in this browser");
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    // Strip speaker labels for cleaner playback
    const cleanText = text.replace(/^.+?:\s/gm, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = LANG_TO_BCP47[targetLang] || "en-US";
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const clearResults = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setOriginalText("");
    setEnglishText("");
    setDetectedLang("");
    setConfidence(null);
    setSpeakers([]);
    setInterimText("");
    setPasteText("");
    setWordCount(0);
    accumulatedTextRef.current = "";
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Languages className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">AI Transcribe & Translate</h1>
          <p className="text-xs text-muted-foreground">World-class two-pass AI translation with confidence scoring</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="mic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="mic" className="gap-1.5 text-xs">
            <Mic className="w-3.5 h-3.5" /> Microphone
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> Upload File
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" /> Paste Text
          </TabsTrigger>
        </TabsList>

        {/* Mic Tab */}
        <TabsContent value="mic" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-col items-center gap-4">
              <Button
                size="lg"
                variant={isListening ? "destructive" : "default"}
                className="rounded-full h-16 w-16"
                onClick={isListening ? stopListening : startListening}
              >
                {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </Button>
              <p className="text-sm text-muted-foreground">
                {isListening ? "Listening… speak now" : "Click to start listening"}
              </p>

              {/* Recording stats */}
              {isListening && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    {formatTime(recordingTime)}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {wordCount} words
                  </span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                  </span>
                </div>
              )}

              {interimText && (
                <p className="text-sm italic text-muted-foreground/70 animate-pulse">{interimText}</p>
              )}

              {/* Live accumulated preview */}
              {isListening && accumulatedTextRef.current && (
                <div className="w-full bg-muted/30 rounded-md p-2 text-xs text-muted-foreground max-h-24 overflow-y-auto">
                  {originalText}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleAudioFile(file);
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drop audio file here or <span className="text-primary underline">browse</span>
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">MP3, WAV, M4A — max 25MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleAudioFile(file);
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Text Tab */}
        <TabsContent value="text" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <Textarea
                placeholder="Paste text in any language…"
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={5}
                className="resize-none"
              />
              <Button onClick={handleTextTranslate} disabled={!pasteText.trim() || isProcessing} className="w-full">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Languages className="w-4 h-4 mr-2" />}
                Translate
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Advanced Options */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
            {advancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Advanced Options
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Card>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Source Language</label>
                <Select value={sourceLang} onValueChange={setSourceLang}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => (
                      <SelectItem key={l.value} value={l.value} className="text-xs">{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Translate To</label>
                <Select value={targetLang} onValueChange={setTargetLang}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_LANGUAGES.map(l => (
                      <SelectItem key={l.value} value={l.value} className="text-xs">{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Formality</label>
                <Select value={formality} onValueChange={setFormality}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual" className="text-xs">Casual</SelectItem>
                    <SelectItem value="neutral" className="text-xs">Neutral</SelectItem>
                    <SelectItem value="formal" className="text-xs">Formal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Context Hint</label>
                <Input
                  placeholder="e.g. manufacturing, legal…"
                  value={contextHint}
                  onChange={e => setContextHint(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Output Format</label>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plain" className="text-xs">Plain Text</SelectItem>
                    <SelectItem value="bullets" className="text-xs">Bullet Points</SelectItem>
                    <SelectItem value="paragraphs" className="text-xs">Paragraphs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Results */}
      {(originalText || englishText || isProcessing) && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Processing with two-pass AI verification…
              </div>
            )}

            {originalText && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Original</span>
                  {detectedLang && <Badge variant="secondary" className="text-[10px]">{detectedLang}</Badge>}
                  <SpeakersBadge speakers={speakers} />
                </div>
                <div className="bg-muted/50 rounded-md p-3">
                  <SpeakerTranscript text={originalText} speakers={speakers} />
                </div>
              </div>
            )}

            {englishText && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {targetLang} Translation
                  </span>
                  {confidence !== null && <ConfidenceBadge confidence={confidence} />}
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-md p-3">
                  <SpeakerTranscript text={englishText} speakers={speakers} />
                </div>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {englishText && (
                <>
                  <Button size="sm" variant="outline" className={`text-xs gap-1.5 ${isSpeaking ? "border-primary text-primary" : ""}`} onClick={() => playVoice(englishText)}>
                    {isSpeaking ? <Square className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    {isSpeaking ? "Stop" : "Play"}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => copyToClipboard(englishText)}>
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={downloadTxt}>
                    <Download className="w-3 h-3" /> Download
                  </Button>
                </>
              )}
              {confidence !== null && confidence < 70 && (
                <Button size="sm" variant="outline" className="text-xs gap-1.5 border-accent/30 text-accent-foreground" onClick={handleRetranslate} disabled={isProcessing}>
                  <RefreshCw className="w-3 h-3" /> Re-translate
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-xs gap-1.5 text-destructive" onClick={clearResults}>
                <Trash2 className="w-3 h-3" /> Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent History</h3>
          <ScrollArea className="max-h-60">
            <div className="space-y-2">
              {history.map(entry => (
                <Card key={entry.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => {
                  setOriginalText(entry.original);
                  setEnglishText(entry.english);
                  setDetectedLang(entry.detectedLang);
                  setConfidence(entry.confidence ?? null);
                  setSpeakers(entry.speakers ?? []);
                }}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline" className="text-[9px]">{entry.mode}</Badge>
                      <Badge variant="secondary" className="text-[9px]">{entry.detectedLang}</Badge>
                      {entry.confidence !== undefined && <ConfidenceBadge confidence={entry.confidence} />}
                      {entry.speakers && entry.speakers.length > 1 && (
                        <Badge variant="outline" className="text-[9px] gap-0.5">
                          <Users className="w-2.5 h-2.5" /> {entry.speakers.length}
                        </Badge>
                      )}
                      <span className="text-[9px] text-muted-foreground ml-auto">
                        {entry.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{entry.english}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
