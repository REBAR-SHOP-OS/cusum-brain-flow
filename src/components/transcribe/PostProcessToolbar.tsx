import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Loader2, Languages, ListChecks, FileText, Sparkles, Eraser, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TARGET_LANGUAGES = [
  "English", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch",
  "Russian", "Chinese", "Japanese", "Korean", "Arabic", "Hindi", "Farsi",
  "Turkish", "Polish", "Vietnamese", "Thai", "Indonesian", "Malay", "Bengali",
  "Urdu", "Swahili", "Hebrew", "Greek", "Czech", "Georgian",
];

interface PostProcessToolbarProps {
  transcript: string;
  onResult: (result: string, type: string) => void;
}

export function PostProcessToolbar({ transcript, onResult }: PostProcessToolbarProps) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [targetLang, setTargetLang] = useState("English");
  const [showCustom, setShowCustom] = useState(false);

  const callPostProcess = async (postProcess: string, extra?: Record<string, string>) => {
    if (!transcript.trim()) {
      toast.error("No transcript to process");
      return;
    }
    setProcessing(postProcess);
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-translate", {
        body: {
          mode: "text",
          text: transcript,
          postProcess,
          targetLang: extra?.targetLang || targetLang,
          customPrompt: extra?.customPrompt,
        },
      });
      if (error) throw new Error(error.message);
      const output = data?.result || data?.english || data?.original || JSON.stringify(data);
      onResult(output, postProcess);
      toast.success(`${postProcess.replace("-", " ")} complete`);
    } catch (err: any) {
      toast.error(err.message || "Processing failed");
    } finally {
      setProcessing(null);
    }
  };

  const actions = [
    { id: "translate", label: "Translate", icon: Languages },
    { id: "summarize", label: "Summarize", icon: Sparkles },
    { id: "action-items", label: "Action Items", icon: ListChecks },
    { id: "meeting-notes", label: "Meeting Notes", icon: FileText },
    { id: "cleanup", label: "Clean Up", icon: Eraser },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {actions.map((action) => (
          <Button
            key={action.id}
            size="sm"
            variant="outline"
            className="text-xs gap-1.5"
            disabled={!!processing || !transcript.trim()}
            onClick={() => callPostProcess(action.id)}
          >
            {processing === action.id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <action.icon className="w-3 h-3" />
            )}
            {action.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="text-xs gap-1.5"
          disabled={!!processing || !transcript.trim()}
          onClick={() => setShowCustom(!showCustom)}
        >
          <MessageSquare className="w-3 h-3" /> Custom
        </Button>
      </div>

      {/* Translate target language selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Translate to:</span>
        <Select value={targetLang} onValueChange={setTargetLang}>
          <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TARGET_LANGUAGES.map((lang) => (
              <SelectItem key={lang} value={lang} className="text-xs">{lang}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showCustom && (
        <div className="flex gap-2">
          <Input
            placeholder="Enter custom instruction…"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="h-8 text-xs flex-1"
          />
          <Button
            size="sm"
            className="text-xs"
            disabled={!!processing || !customPrompt.trim()}
            onClick={() => callPostProcess("custom", { customPrompt })}
          >
            {processing === "custom" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Run"}
          </Button>
        </div>
      )}
    </div>
  );
}
