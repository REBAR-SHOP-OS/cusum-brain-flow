import { useEffect, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { detectRtl } from "@/utils/textDirection";
import { cn } from "@/lib/utils";

interface AIPromptDialogProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (userInput: string) => void;
  generating: boolean;
  contextChips: string[];
}

export function AIPromptDialog({ open, onClose, onGenerate, generating, contextChips }: AIPromptDialogProps) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  const isRtl = detectRtl(text);
  const canSubmit = text.trim().length > 0 && !generating;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !generating && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Write prompt with AI
          </DialogTitle>
          <DialogDescription>
            Tell us what you want — we'll engineer the cinematic prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe your ad idea, target audience, mood, key message…"
            rows={6}
            dir={isRtl ? "rtl" : "ltr"}
            className={cn(
              "w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isRtl && "text-right"
            )}
            autoFocus
          />

          {contextChips.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Auto-included context
              </p>
              <div className="flex flex-wrap gap-1.5">
                {contextChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={generating}>
            Cancel
          </Button>
          <Button onClick={() => onGenerate(text.trim())} disabled={!canSubmit}>
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {generating ? "Generating..." : "Generate Prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
