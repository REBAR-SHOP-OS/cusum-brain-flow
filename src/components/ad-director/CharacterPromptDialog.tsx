import { useState } from "react";
import { Loader2, UserSquare, Sparkles, Check } from "lucide-react";
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
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { useToast } from "@/hooks/use-toast";
import { classifyEdgeFunctionError } from "@/lib/edgeFunctionError";
import { cn } from "@/lib/utils";

interface CharacterPromptDialogProps {
  open: boolean;
  onClose: () => void;
  text: string;
  onTextChange: (value: string) => void;
  onSave: () => void;
  characterPreviewUrl: string | null;
  brandContext?: string;
  durationSec?: number;
  productsContext?: string;
}

const PLACEHOLDER =
  "What should the character say or do?\n\nExample: \"Look directly at the camera and confidently introduce REBAR SHOP. Invite viewers to upload their drawings and request a fast quote. Smile warmly at the end.\"";

export function CharacterPromptDialog({
  open,
  onClose,
  text,
  onTextChange,
  onSave,
  characterPreviewUrl,
  brandContext,
  durationSec,
  productsContext,
}: CharacterPromptDialogProps) {
  const [improving, setImproving] = useState(false);
  const { toast } = useToast();
  const isRtl = detectRtl(text);
  const canSave = text.trim().length > 0 && !improving;

  const handleImprove = async () => {
    if (improving) return;
    const seed = text.trim();
    const isGenerating = seed.length === 0;
    setImproving(true);
    try {
      const dur = Number.isFinite(durationSec) && (durationSec ?? 0) > 0 ? Math.round(durationSec as number) : 15;
      // ~140 wpm advertising pace ≈ 2.3 words/sec
      const wordBudget = Math.max(6, Math.round(dur * 2.3));
      const sentenceGuidance =
        dur <= 6 ? "1 short sentence" :
        dur <= 10 ? "1–2 short sentences" :
        dur <= 15 ? "2–3 sentences" :
        dur <= 20 ? "2–3 sentences" :
        "3–5 sentences";

      const sharedRules = [
        `VIDEO DURATION: EXACTLY ${dur} seconds (≈ ${wordBudget} spoken words MAX at natural advertising pace).`,
        `LENGTH: ${sentenceGuidance}. Dialogue MUST be sayable within ${dur}s — do not exceed ${wordBudget} words of spoken text.`,
        "MUST include (non-negotiable):",
        "- Explicitly mention the company / brand name on camera.",
        "- Pitch the specific product or service with one concrete benefit.",
        "- End with a clear, direct call-to-action for the viewer.",
        "Constraints:",
        "- Keep the character's identity, face, body, and clothing UNCHANGED. Do NOT describe their appearance.",
        "- Focus on: exact words to say (in quotes if helpful), tone of voice, facial expression, eye contact, gestures.",
        "- Cinematic, persuasive, sales-driven advertising tone.",
        "- No headings, no bullet lists in the output.",
        brandContext ? `Brand context: ${brandContext}` : "",
        productsContext ? `Products / services to advertise: ${productsContext}` : "",
        "Return ONLY the direction text — no preamble, no quotes around the whole thing.",
      ].filter(Boolean);

      const instruction = isGenerating
        ? [
            "You WRITE a fresh character-direction note for an AI video model (image-to-video).",
            "The character (a real person from a reference photo) MUST advertise the company and its product on camera.",
            ...sharedRules,
          ].join("\n")
        : [
            "You rewrite a character-direction note for an AI video model (image-to-video).",
            "The character (a real person from a reference photo) MUST advertise the company and its product on camera.",
            ...sharedRules,
          ].join("\n");

      const userPayload = isGenerating
        ? instruction
        : `${instruction}\n\nUSER NOTE TO IMPROVE:\n${seed}`;

      const result = await invokeEdgeFunction<{
        ok?: boolean;
        error?: string;
        status?: number;
        result?: { text?: string };
        text?: string;
      }>(
        "ad-director-ai",
        {
          action: "write-script",
          input: userPayload,
        },
        { allowErrorResponse: true },
      );

      if (result?.ok === false || result?.error) {
        const info = classifyEdgeFunctionError(
          { status: result?.status, message: result?.error ?? (isGenerating ? "Generation failed" : "Improve failed") },
          isGenerating ? "Generation failed" : "Improve failed",
        );
        toast({ title: info.title, description: info.description, variant: "destructive" });
        return;
      }

      const improved = (result?.result?.text ?? result?.text ?? "").trim();
      if (improved) {
        onTextChange(improved);
        toast({
          title: isGenerating ? "✨ Generated" : "✨ Improved",
          description: isGenerating
            ? `Character ad direction written for ${dur}s.`
            : `Character ad direction refined for ${dur}s.`,
        });
      } else {
        toast({ title: "No result", description: "Try again.", variant: "destructive" });
      }
    } catch (err) {
      console.error("character improve error:", err);
      const info = classifyEdgeFunctionError(err, isGenerating ? "Generation failed" : "Improve failed");
      toast({
        title: info.title,
        description: info.description,
        variant: "destructive",
      });
    } finally {
      setImproving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !improving && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserSquare className="h-5 w-5 text-primary" />
            Character Direction
          </DialogTitle>
          <DialogDescription>
            Tell this character exactly what to say and do. Their face and look stay the same in every scene.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {characterPreviewUrl && (
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-2">
              <img
                src={characterPreviewUrl}
                alt="Character reference"
                className="h-14 w-14 rounded-md object-cover"
              />
              <div className="text-xs text-muted-foreground">
                This face will appear in every scene. Write what they should say or do below.
              </div>
            </div>
          )}

          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={9}
              dir={isRtl ? "rtl" : "ltr"}
              disabled={improving}
              className={cn(
                "w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                isRtl && "text-right",
              )}
            />
            {improving && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Improving…
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleImprove}
            disabled={improving}
            className="mr-auto"
          >
            {improving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {text.trim().length === 0 ? "Write with AI" : "Improve with AI"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={improving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave}>
            <Check className="h-4 w-4" />
            Save direction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
