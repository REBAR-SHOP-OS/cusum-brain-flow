import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface LossGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  companyId: string;
  onComplete: () => void;
}

const LOSS_REASONS = [
  "Price Too High",
  "Lost to Competitor",
  "Budget Cut",
  "Timing Issue",
  "Scope Change",
  "Other",
] as const;

export function LossGateModal({
  open, onOpenChange, leadId, companyId, onComplete,
}: LossGateModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const [lossReason, setLossReason] = useState<string>("");
  const [competitorName, setCompetitorName] = useState("");
  const [winningPriceKnown, setWinningPriceKnown] = useState(false);
  const [winningPrice, setWinningPrice] = useState("");

  const needsCompetitor = lossReason === "Lost to Competitor";
  const needsWinningPrice = winningPriceKnown;

  const isValid =
    lossReason &&
    (!needsCompetitor || competitorName.trim()) &&
    (!needsWinningPrice || (winningPrice && Number(winningPrice) > 0));

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("lead_loss_memory").insert({
        lead_id: leadId,
        company_id: companyId,
        loss_reason: lossReason,
        competitor_name: competitorName.trim() || null,
        winning_price_known: winningPriceKnown,
        winning_price: winningPriceKnown && winningPrice ? Number(winningPrice) : null,
      });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["pipeline-memory-check", leadId] });
      toast({ title: "Loss intelligence captured" });
      onComplete();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Loss Intelligence</DialogTitle>
          <DialogDescription>
            Capture the reason for losing this lead before closing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Loss Reason *</Label>
            <Select value={lossReason} onValueChange={setLossReason}>
              <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
              <SelectContent>
                {LOSS_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsCompetitor && (
            <div className="space-y-1.5">
              <Label>Competitor Name *</Label>
              <Input
                placeholder="Who won this deal?"
                value={competitorName} onChange={(e) => setCompetitorName(e.target.value)}
              />
            </div>
          )}

          {!needsCompetitor && lossReason && (
            <div className="space-y-1.5">
              <Label>Competitor Name (optional)</Label>
              <Input
                placeholder="If known..."
                value={competitorName} onChange={(e) => setCompetitorName(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch checked={winningPriceKnown} onCheckedChange={setWinningPriceKnown} />
            <Label className="text-sm">Winning price is known</Label>
          </div>

          {needsWinningPrice && (
            <div className="space-y-1.5">
              <Label>Winning Price ($) *</Label>
              <Input
                type="number" min="0.01" step="0.01" placeholder="e.g. 38000"
                value={winningPrice} onChange={(e) => setWinningPrice(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save &amp; Close as Lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
