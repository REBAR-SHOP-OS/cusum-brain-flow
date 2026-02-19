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

interface QualificationGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  companyId: string;
  onComplete: () => void;
}

const PROJECT_TYPES = ["Residential", "Commercial", "Infrastructure", "Industrial"] as const;

export function QualificationGateModal({
  open, onOpenChange, leadId, companyId, onComplete,
}: QualificationGateModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const [projectType, setProjectType] = useState<string>("");
  const [estimatedTonnage, setEstimatedTonnage] = useState("");
  const [deadline, setDeadline] = useState("");
  const [decisionMakerIdentified, setDecisionMakerIdentified] = useState(false);
  const [budgetKnown, setBudgetKnown] = useState(false);
  const [repeatCustomer, setRepeatCustomer] = useState(false);
  const [competitorsInvolved, setCompetitorsInvolved] = useState(false);

  const isValid = projectType && estimatedTonnage && Number(estimatedTonnage) > 0 && deadline;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("lead_qualification_memory").insert({
        lead_id: leadId,
        company_id: companyId,
        project_type: projectType,
        estimated_tonnage: Number(estimatedTonnage),
        deadline,
        decision_maker_identified: decisionMakerIdentified,
        budget_known: budgetKnown,
        repeat_customer: repeatCustomer,
        competitors_involved: competitorsInvolved,
      });
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["pipeline-memory-check", leadId] });
      toast({ title: "Qualification captured" });
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
          <DialogTitle>Qualification Memory</DialogTitle>
          <DialogDescription>
            Capture project details before moving to quotation stage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Project Type *</Label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Estimated Tonnage *</Label>
            <Input
              type="number" min="0.01" step="0.01" placeholder="e.g. 150"
              value={estimatedTonnage} onChange={(e) => setEstimatedTonnage(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Deadline *</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={decisionMakerIdentified} onCheckedChange={setDecisionMakerIdentified} />
              <Label className="text-sm">Decision Maker ID'd</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={budgetKnown} onCheckedChange={setBudgetKnown} />
              <Label className="text-sm">Budget Known</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={repeatCustomer} onCheckedChange={setRepeatCustomer} />
              <Label className="text-sm">Repeat Customer</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={competitorsInvolved} onCheckedChange={setCompetitorsInvolved} />
              <Label className="text-sm">Competitors Involved</Label>
            </div>
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
