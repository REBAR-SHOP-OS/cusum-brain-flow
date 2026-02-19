import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { GateStepIndicator } from "./GateStepIndicator";

interface DeliveryGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  companyId: string;
  customerId?: string | null;
  onComplete: () => void;
  gateStep?: number;
  gateTotalSteps?: number;
  expectedValue?: number | null;
}

const REORDER_OPTIONS = ["Low", "Medium", "High"] as const;

export function DeliveryGateModal({
  open, onOpenChange, leadId, companyId, customerId, onComplete, gateStep = 0, gateTotalSteps = 1, expectedValue,
}: DeliveryGateModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const [finalRevenue, setFinalRevenue] = useState("");
  const [finalCost, setFinalCost] = useState("");
  const [delayOccurred, setDelayOccurred] = useState(false);
  const [satisfaction, setSatisfaction] = useState(0);
  const [reorderProbability, setReorderProbability] = useState<string>("");

  // Pre-fill revenue from lead's expected_value when modal opens
  useEffect(() => {
    if (open && expectedValue && !finalRevenue) {
      setFinalRevenue(String(expectedValue));
    }
  }, [open, expectedValue]);

  const computedMargin = finalRevenue && Number(finalRevenue) > 0 && finalCost
    ? ((Number(finalRevenue) - Number(finalCost)) / Number(finalRevenue) * 100).toFixed(1)
    : null;

  const isValid =
    finalRevenue && Number(finalRevenue) >= 0 &&
    finalCost && Number(finalCost) >= 0 &&
    satisfaction >= 1 && satisfaction <= 5 &&
    reorderProbability;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("lead_outcome_memory").insert({
        lead_id: leadId,
        company_id: companyId,
        customer_id: customerId || null,
        final_revenue: Number(finalRevenue),
        final_cost: Number(finalCost),
        delay_occurred: delayOccurred,
        client_satisfaction: satisfaction,
        reorder_probability: reorderProbability,
      });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["pipeline-memory-check", leadId] });
      toast({ title: "Delivery performance captured" });
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
          <GateStepIndicator current={gateStep} total={gateTotalSteps} />
          <DialogTitle>Delivery Performance</DialogTitle>
          <DialogDescription>
            Capture final delivery metrics and client satisfaction before closing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Final Revenue ($) *</Label>
              <Input
                type="number" min="0" step="0.01" placeholder="e.g. 50000"
                value={finalRevenue} onChange={(e) => setFinalRevenue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Final Cost ($) *</Label>
              <Input
                type="number" min="0" step="0.01" placeholder="e.g. 35000"
                value={finalCost} onChange={(e) => setFinalCost(e.target.value)}
              />
            </div>
          </div>

          {computedMargin !== null && (
            <div className="text-sm text-muted-foreground">
              Calculated margin: <span className={cn("font-bold", Number(computedMargin) >= 0 ? "text-green-600" : "text-destructive")}>{computedMargin}%</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch checked={delayOccurred} onCheckedChange={setDelayOccurred} />
            <Label className="text-sm">Delay occurred during delivery</Label>
          </div>

          <div className="space-y-1.5">
            <Label>Client Satisfaction *</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSatisfaction(n)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={cn(
                      "w-6 h-6",
                      n <= satisfaction ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
              {satisfaction > 0 && (
                <span className="text-sm text-muted-foreground ml-2 self-center">{satisfaction}/5</span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Reorder Probability *</Label>
            <Select value={reorderProbability} onValueChange={setReorderProbability}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {REORDER_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save &amp; Close Delivered
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
