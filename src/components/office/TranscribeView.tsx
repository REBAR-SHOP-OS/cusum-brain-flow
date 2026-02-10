import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Upload, FileText, Copy, Download, Trash2, ChevronDown, ChevronUp, Loader2, Languages } from "lucide-react";
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

interface HistoryEntry {
  id: string;
  original: string;
  english: string;
  detectedLang: string;
  mode: string;
  timestamp: Date;
}

export function TranscribeView() {
  const [sourceLang, setSourceLang] = useState("auto");
  const [formality, setFormality] = useState("neutral");
  const [contextHint, setContextHint] = useState("");
  const [outputFormat, setOutputFormat] = useState("plain");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Results
  const [originalText, setOriginalText] = useState("");
  const [englishText, setEnglishText] = useState("");
  const [detectedLang, setDetectedLang] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Mic
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<any>(null);
  const hasTranslatedRef = useRef(false);

  // Text paste
  const [pasteText, setPasteText] = useState("");

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);

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
    // Only set lang if not auto-detect; empty string can cause errors
    if (sourceLang !== "auto") {
      recognition.lang = sourceLang;
    }

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
      if (final) {
        setOriginalText(prev => prev + (prev ? " " : "") + final);
        setInterimText("");
        hasTranslatedRef.current = true;
        callTranslateAPI({
          mode: "text",
          text: final,
          sourceLang,
          formality,
          context: contextHint,
          outputFormat,
        }).then(result => {
          setEnglishText(prev => prev + (prev ? " " : "") + result.english);
          setDetectedLang(result.detectedLang);
          addToHistory({ original: final, english: result.english, detectedLang: result.detectedLang, mode: "mic" });
        }).catch(err => toast.error(err.message));
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied");
        setIsListening(false);
      } else if (event.error === "no-speech") {
        // Don't stop — just inform briefly
        toast.info("No speech detected, still listening…");
      } else {
        toast.error(`Speech error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      }
    };

    hasTranslatedRef.current = false;
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setOriginalText("");
    setEnglishText("");
    setDetectedLang("");
    setInterimText("");
  };

  const stopListening = async () => {
    const ref = recognitionRef.current;
    recognitionRef.current = null;
    ref?.stop();
    setIsListening(false);

    // Flush any pending interim text as original and translate everything
    setInterimText(prev => {
      if (prev.trim()) {
        setOriginalText(old => old + (old ? " " : "") + prev.trim());
      }
      return "";
    });

    // Use a small delay to let state settle, then translate all accumulated text
    setTimeout(() => {
      setOriginalText(currentOriginal => {
        if (currentOriginal.trim() && !hasTranslatedRef.current) {
          // No final chunks were translated yet — translate everything now
          callTranslateAPI({
            mode: "text",
            text: currentOriginal.trim(),
            sourceLang,
            formality,
            context: contextHint,
            outputFormat,
          }).then(result => {
            setEnglishText(result.english || "");
            setDetectedLang(result.detectedLang || "");
            addToHistory({ original: currentOriginal.trim(), english: result.english || "", detectedLang: result.detectedLang || "", mode: "mic" });
            toast.success("Translation complete");
          }).catch(err => toast.error(err.message));
        }
        return currentOriginal;
      });
    }, 100);
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
    formData.append("formality", formality);
    formData.append("context", contextHint);
    formData.append("outputFormat", outputFormat);

    try {
      const result = await callTranslateAPI(formData, true);
      setOriginalText(result.transcript || result.original || "");
      setEnglishText(result.english || "");
      setDetectedLang(result.detectedLang || "");
      addToHistory({
        original: result.transcript || result.original || "",
        english: result.english || "",
        detectedLang: result.detectedLang || "",
        mode: "upload",
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
        formality,
        context: contextHint,
        outputFormat,
      });
      setOriginalText(result.original || pasteText);
      setEnglishText(result.english || "");
      setDetectedLang(result.detectedLang || "");
      addToHistory({
        original: result.original || pasteText,
        english: result.english || "",
        detectedLang: result.detectedLang || "",
        mode: "text",
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
    const content = `Original (${detectedLang}):\n${originalText}\n\nEnglish Translation:\n${englishText}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcription-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearResults = () => {
    setOriginalText("");
    setEnglishText("");
    setDetectedLang("");
    setInterimText("");
    setPasteText("");
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
          <p className="text-xs text-muted-foreground">Transcribe any language to English with AI</p>
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
              {interimText && (
                <p className="text-sm italic text-muted-foreground/70 animate-pulse">{interimText}</p>
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
                Translate to English
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
                <Loader2 className="w-4 h-4 animate-spin" /> Processing…
              </div>
            )}

            {originalText && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Original</span>
                  {detectedLang && <Badge variant="secondary" className="text-[10px]">{detectedLang}</Badge>}
                </div>
                <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap">{originalText}</div>
              </div>
            )}

            {englishText && (
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">English Translation</span>
                <div className="bg-primary/5 border border-primary/10 rounded-md p-3 text-sm whitespace-pre-wrap">{englishText}</div>
              </div>
            )}

            <div className="flex gap-2">
              {englishText && (
                <>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => copyToClipboard(englishText)}>
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={downloadTxt}>
                    <Download className="w-3 h-3" /> Download
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
                }}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[9px]">{entry.mode}</Badge>
                      <Badge variant="secondary" className="text-[9px]">{entry.detectedLang}</Badge>
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
