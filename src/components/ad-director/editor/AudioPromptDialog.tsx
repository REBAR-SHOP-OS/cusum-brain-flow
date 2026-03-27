import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Loader2, Music, Mic } from "lucide-react";

export interface AudioPromptResult {
  type: "music" | "voiceover";
  prompt: string;
  duration: number;
}

interface AudioPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (result: AudioPromptResult) => void;
  loading?: boolean;
}

export function AudioPromptDialog({ open, onOpenChange, onGenerate, loading }: AudioPromptDialogProps) {
  const [type, setType] = useState<"music" | "voiceover">("music");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("30");

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onGenerate({ type, prompt: prompt.trim(), duration: Number(duration) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle>تولید صدا</DialogTitle>
          <DialogDescription>یک پرامپت وارد کنید تا صدای جدید تولید شود.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type toggle */}
          <div className="space-y-2">
            <Label>نوع</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as "music" | "voiceover")} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="music" id="type-music" />
                <Label htmlFor="type-music" className="flex items-center gap-1 cursor-pointer">
                  <Music className="w-3.5 h-3.5" /> موسیقی
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="voiceover" id="type-vo" />
                <Label htmlFor="type-vo" className="flex items-center gap-1 cursor-pointer">
                  <Mic className="w-3.5 h-3.5" /> صداگذاری
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <Label>پرامپت</Label>
            <Input
              placeholder={type === "music" ? "cinematic intro music..." : "متن صداگذاری..."}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
            />
          </div>

          {/* Duration (music only) */}
          {type === "music" && (
            <div className="space-y-2">
              <Label>مدت زمان</Label>
              <ToggleGroup type="single" value={duration} onValueChange={(v) => v && setDuration(v)} className="justify-start">
                <ToggleGroupItem value="15" className="text-xs">15s</ToggleGroupItem>
                <ToggleGroupItem value="30" className="text-xs">30s</ToggleGroupItem>
                <ToggleGroupItem value="60" className="text-xs">60s</ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!prompt.trim() || loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> در حال تولید...</> : "تولید صدا"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
