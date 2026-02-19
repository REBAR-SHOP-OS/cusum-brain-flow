import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface PricingGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  companyId: string;
  onComplete: () => void;
}

const PRIORITIES = ["Low", "Medium", "High"] as const;

export function PricingGateModal({
  open, onOpenChange, leadId, companyId, onComplete,
}: PricingGateModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const [quotedPrice, setQuotedPrice] = useState("");
  const [targetMargin, setTargetMargin] = useState("");
  const [materialCost, setMaterialCost] = useState("");
  const [strategicPriority, setStrategicPriority] = useState<string>("");
  const [notes, setNotes] = useState("");

  const isValid =
    quotedPrice && Number(quotedPrice) > 0 &&
    targetMargin && Number(targetMargin) >= -100 && Number(targetMargin) <= 100 &&
    materialCost && Number(materialCost) >= 0 &&
    strategicPriority;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("lead_quote_memory").insert({
        lead_id: leadId,
        company_id: companyId,
        quoted_price: Number(quotedPrice),
        target_margin_pct: Number(targetMargin),
        material_cost_snapshot: Number(materialCost),
        strategic_priority: strategicPriority,
        notes: notes || null,
      });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["pipeline-memory-check", leadId] });
      toast({ title: "Pricing intelligence captured" });
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
          <DialogTitle>Pricing Intelligence</DialogTitle>
          <DialogDescription>
            Capture quote pricing details before submitting this bid.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Quoted Price ($) *</Label>
            <Input
              type="number" min="0.01" step="0.01" placeholder="e.g. 45000"
              value={quotedPrice} onChange={(e) => setQuotedPrice(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Target Margin (%) *</Label>
            <Input
              type="number" min="-100" max="100" step="0.1" placeholder="e.g. 18.5"
              value={targetMargin} onChange={(e) => setTargetMargin(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Material Cost Snapshot ($) *</Label>
            <Input
              type="number" min="0" step="0.01" placeholder="e.g. 32000"
              value={materialCost} onChange={(e) => setMaterialCost(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Strategic Priority *</Label>
            <Select value={strategicPriority} onValueChange={setStrategicPriority}>
              <SelectTrigger><SelectValue placeholder="Select priority..." /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any additional context..."
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save &amp; Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
