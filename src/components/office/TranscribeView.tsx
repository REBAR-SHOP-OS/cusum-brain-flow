import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Mic, MicOff, Upload, FileText, Copy, Download, Trash2, ChevronDown, ChevronUp, Loader2, Languages, RefreshCw, Timer, Users, Volume2, Square, Save, Watch } from "lucide-react";
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
import { useRealtimeTranscribe } from "@/hooks/useRealtimeTranscribe";
import { LiveTranscript } from "@/components/transcribe/LiveTranscript";
import { PostProcessToolbar } from "@/components/transcribe/PostProcessToolbar";
import { AudioWaveform } from "@/components/transcribe/AudioWaveform";
import { useNavigate } from "react-router-dom";

const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "fa", label: "Farsi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "ka", label: "Georgian" },
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
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-normal ${color}`}>
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
  const navigate = useNavigate();
  const [sourceLang, setSourceLang] = useState("auto");
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

  // Post-process result
  const [processedOutput, setProcessedOutput] = useState("");
  const [processedType, setProcessedType] = useState("");

  // Text paste
  const [pasteText, setPasteText] = useState("");

  // Realtime transcription
  const realtime = useRealtimeTranscribe();

  // Recording timer for realtime
  const [realtimeTime, setRealtimeTime] = useState(0);
  const realtimeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (realtime.isConnected) {
      setRealtimeTime(0);
      realtimeTimerRef.current = setInterval(() => setRealtimeTime(prev => prev + 1), 1000);
    } else {
      if (realtimeTimerRef.current) {
        clearInterval(realtimeTimerRef.current);
        realtimeTimerRef.current = null;
      }
    }
    return () => { if (realtimeTimerRef.current) clearInterval(realtimeTimerRef.current); };
  }, [realtime.isConnected]);

  // When realtime disconnects with content, populate originalText
  useEffect(() => {
    if (!realtime.isConnected && realtime.committedTranscripts.length > 0) {
      const fullText = realtime.getFullTranscript();
      if (fullText.trim()) {
        setOriginalText(fullText);
      }
    }
  }, [realtime.isConnected, realtime.committedTranscripts.length]);

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

  // --- Upload Tab ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProcessing, setUploadProcessing] = useState(false);

  const handleAudioFile = async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Please upload an audio file (MP3, WAV, M4A)");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File too large (max 25MB)");
      return;
    }

    setUploadProcessing(true);
    try {
      // Use ElevenLabs batch transcription
      const formData = new FormData();
      formData.append("audio", file);
      if (sourceLang !== "auto") {
        formData.append("language_code", sourceLang);
      }

      const { data, error } = await supabase.functions.invoke("elevenlabs-transcribe", {
        body: formData,
      });

      if (error) throw new Error(error.message);

      const transcript = data?.text || "";
      const wordSpeakers = new Set<string>();
      if (data?.words) {
        data.words.forEach((w: any) => {
          if (w.speaker) wordSpeakers.add(w.speaker);
        });
      }

      setOriginalText(transcript);
      setDetectedLang(data?.language_code || "auto");
      setSpeakers(Array.from(wordSpeakers));
      setEnglishText("");
      setConfidence(null);
      toast.success("Transcription complete via ElevenLabs Scribe");
    } catch (err: any) {
      toast.error(err.message || "Transcription failed");
    } finally {
      setUploadProcessing(false);
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
        targetLang: "English",
        formality,
        context: contextHint,
        outputFormat,
      });
      setOriginalText(result.original || pasteText);
      setEnglishText(result.english || "");
      setDetectedLang(result.detectedLang || "");
      setConfidence(typeof result.confidence === "number" ? result.confidence : null);
      setSpeakers(Array.isArray(result.speakers) ? result.speakers : []);
      toast.success("Translation complete");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Post-process handler
  const handlePostProcessResult = (result: string, type: string) => {
    setProcessedOutput(result);
    setProcessedType(type);
  };

  // --- Actions ---
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const downloadTxt = () => {
    const parts = [];
    if (originalText) parts.push(`Original (${detectedLang}):\n${originalText}`);
    if (englishText) parts.push(`Translation:\n${englishText}`);
    if (processedOutput) parts.push(`${processedType}:\n${processedOutput}`);
    if (confidence !== null) parts.push(`Confidence: ${confidence}%`);
    const content = parts.join("\n\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcription-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadSRT = () => {
    if (!realtime.committedTranscripts.length && !originalText) return;
    const entries = realtime.committedTranscripts.length > 0
      ? realtime.committedTranscripts.map((t, i) => {
          const startSec = t.timestamp;
          const endSec = startSec + Math.max(3, Math.ceil(t.text.length / 15));
          const fmtTime = (s: number) => {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},000`;
          };
          return `${i + 1}\n${fmtTime(startSec)} --> ${fmtTime(endSec)}\n${t.text}\n`;
        })
      : originalText.split(". ").map((s, i) => `${i + 1}\n00:00:${String(i * 3).padStart(2, "0")},000 --> 00:00:${String((i + 1) * 3).padStart(2, "0")},000\n${s.trim()}\n`);

    const blob = new Blob([entries.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcription-${Date.now()}.srt`;
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
      toast.error("Voice playback not supported");
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const cleanText = text.replace(/^.+?:\s/gm, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-US";
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Save session
  const [saving, setSaving] = useState(false);
  const saveSession = async () => {
    const text = originalText || realtime.getFullTranscript();
    if (!text.trim()) { toast.error("Nothing to save"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("id, company_id")
        .eq("user_id", user.id)
        .single();
      if (!profile) throw new Error("No profile");

      await (supabase as any).from("transcription_sessions").insert({
        profile_id: profile.id,
        company_id: profile.company_id,
        title: `Session ${new Date().toLocaleString()}`,
        raw_transcript: text,
        processed_output: processedOutput || englishText || null,
        process_type: processedType || "transcribe",
        source_language: detectedLang || null,
        speaker_count: speakers.length || 1,
      });
      toast.success("Session saved!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const clearResults = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setOriginalText("");
    setEnglishText("");
    setDetectedLang("");
    setConfidence(null);
    setSpeakers([]);
    setPasteText("");
    setProcessedOutput("");
    setProcessedType("");
    realtime.clearTranscripts();
  };

  const hasContent = originalText || englishText || processedOutput || realtime.committedTranscripts.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Languages className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">AI Transcribe & Translate</h1>
            <p className="text-xs text-muted-foreground">ElevenLabs Scribe + Gemini AI — realtime streaming & post-processing</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => navigate("/transcribe/watch")}
        >
          <Watch className="w-3.5 h-3.5" /> Watch Mode
        </Button>
      </div>

      {/* Input Tabs */}
      <Tabs defaultValue="realtime" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="realtime" className="gap-1.5 text-xs">
            <Mic className="w-3.5 h-3.5" /> Realtime
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> Upload
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" /> Text
          </TabsTrigger>
          <TabsTrigger value="translate" className="gap-1.5 text-xs">
            <Languages className="w-3.5 h-3.5" /> Translate
          </TabsTrigger>
        </TabsList>

        {/* Realtime Tab */}
        <TabsContent value="realtime" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-col items-center gap-4">
              <Button
                size="lg"
                variant={realtime.isConnected ? "destructive" : "default"}
                className="rounded-full h-16 w-16"
                onClick={realtime.isConnected ? realtime.disconnect : realtime.connect}
                disabled={realtime.isConnecting}
              >
                {realtime.isConnecting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : realtime.isConnected ? (
                  <Square className="w-5 h-5" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </Button>
              <p className="text-sm text-muted-foreground">
                {realtime.isConnecting
                  ? "Connecting to ElevenLabs Scribe…"
                  : realtime.isConnected
                  ? "Transcribing live — speak now"
                  : "Click to start live transcription"}
              </p>

              {realtime.isConnected && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3" />
                    {formatTime(realtimeTime)}
                  </span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                  </span>
                </div>
              )}

              {/* Waveform */}
              <AudioWaveform isActive={realtime.isConnected} />
            </CardContent>
          </Card>

          {/* Live transcript */}
          <LiveTranscript
            committed={realtime.committedTranscripts}
            partial={realtime.partialText}
            isActive={realtime.isConnected}
          />
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
                {uploadProcessing ? (
                  <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-2" />
                ) : (
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                )}
                <p className="text-sm text-muted-foreground">
                  {uploadProcessing ? "Transcribing with ElevenLabs Scribe…" : (
                    <>Drop audio file here or <span className="text-primary underline">browse</span></>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">MP3, WAV, M4A — max 25MB • Speaker diarization enabled</p>
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

        {/* Translate Tab (for translating existing transcript) */}
        <TabsContent value="translate" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {originalText
                  ? "Use the AI toolbar below to translate, summarize, extract action items, or process your transcript."
                  : "Record or upload audio first, then use this tab to apply AI processing."}
              </p>
              {originalText && (
                <div className="bg-muted/50 rounded-md p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs text-muted-foreground mb-1">Current transcript:</p>
                  <p className="text-sm">{originalText.slice(0, 500)}{originalText.length > 500 ? "…" : ""}</p>
                </div>
              )}
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

      {/* AI Post-Processing Toolbar */}
      {originalText && (
        <Card>
          <CardContent className="p-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">AI Processing</p>
            <PostProcessToolbar
              transcript={originalText}
              onResult={handlePostProcessResult}
            />
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {(hasContent || isProcessing) && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Processing…
              </div>
            )}

            {originalText && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Transcript</span>
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
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Translation</span>
                  {confidence !== null && <ConfidenceBadge confidence={confidence} />}
                </div>
                <div className="bg-primary/5 border border-primary/10 rounded-md p-3">
                  <SpeakerTranscript text={englishText} speakers={speakers} />
                </div>
              </div>
            )}

            {processedOutput && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {processedType.replace("-", " ")}
                  </span>
                  <Badge variant="outline" className="text-[9px]">AI</Badge>
                </div>
                <div className="bg-accent/30 border border-accent/20 rounded-md p-3">
                  <div className="text-sm whitespace-pre-wrap">{processedOutput}</div>
                </div>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {(englishText || originalText) && (
                <>
                  <Button size="sm" variant="outline" className={`text-xs gap-1.5 ${isSpeaking ? "border-primary text-primary" : ""}`} onClick={() => playVoice(englishText || originalText)}>
                    {isSpeaking ? <Square className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    {isSpeaking ? "Stop" : "Play"}
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => copyToClipboard(processedOutput || englishText || originalText)}>
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={downloadTxt}>
                    <Download className="w-3 h-3" /> TXT
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={downloadSRT}>
                    <Download className="w-3 h-3" /> SRT
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={saveSession} disabled={saving}>
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" className="text-xs gap-1.5 text-destructive" onClick={clearResults}>
                <Trash2 className="w-3 h-3" /> Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
