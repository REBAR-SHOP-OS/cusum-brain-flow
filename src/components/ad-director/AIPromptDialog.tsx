import { Loader2, Sparkles, RefreshCw, Check } from "lucide-react";
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
  text: string;
  onTextChange: (value: string) => void;
  onUse: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
  contextChips: string[];
}

export function AIPromptDialog({
  open,
  onClose,
  text,
  onTextChange,
  onUse,
  onRegenerate,
  regenerating,
  contextChips,
}: AIPromptDialogProps) {
  const isRtl = detectRtl(text);
  const canUse = text.trim().length > 0 && !regenerating;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !regenerating && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Prompt Preview
          </DialogTitle>
          <DialogDescription>
            Generated from your selections. Edit if you'd like, then use it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {contextChips.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Based on your selections
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

          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="AI is writing your cinematic prompt…"
              rows={10}
              dir={isRtl ? "rtl" : "ltr"}
              disabled={regenerating}
              className={cn(
                "w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                isRtl && "text-right"
              )}
            />
            {regenerating && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Regenerating…
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onRegenerate}
            disabled={regenerating}
            className="mr-auto"
          >
            {regenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Regenerate
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={regenerating}>
            Cancel
          </Button>
          <Button onClick={onUse} disabled={!canUse}>
            <Check className="h-4 w-4" />
            Use this prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
