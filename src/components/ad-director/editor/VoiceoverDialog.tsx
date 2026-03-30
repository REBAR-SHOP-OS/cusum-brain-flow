import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Mic } from "lucide-react";

const VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel" },
] as const;

export interface VoiceoverResult {
  text: string;
  voiceId: string;
  speed: number;
}

interface VoiceoverDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (result: VoiceoverResult) => void;
  generating?: boolean;
}

export function VoiceoverDialog({ open, onClose, onGenerate, generating }: VoiceoverDialogProps) {
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState<string>(VOICES[0].id);
  const [speed, setSpeed] = useState(1.0);

  const handleGenerate = () => {
    if (!text.trim()) return;
    onGenerate({ text: text.trim(), voiceId, speed });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Mic className="w-4 h-4" />
            Generate Voiceover
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Enter text to be spoken..."
            className="text-sm min-h-[100px]"
            dir="auto"
          />
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Voice</label>
            <Select value={voiceId} onValueChange={setVoiceId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map(v => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Speed</label>
              <span className="text-xs text-muted-foreground">{speed.toFixed(1)}x</span>
            </div>
            <Slider
              min={0.7}
              max={1.2}
              step={0.1}
              value={[speed]}
              onValueChange={([v]) => setSpeed(v)}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Max 5000 characters • Replaces previous voiceover
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={generating}>Cancel</Button>
          <Button size="sm" onClick={handleGenerate} disabled={!text.trim() || generating}>
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Mic className="w-3.5 h-3.5 mr-1" />}
            {generating ? "Generating..." : "Generate Voice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
