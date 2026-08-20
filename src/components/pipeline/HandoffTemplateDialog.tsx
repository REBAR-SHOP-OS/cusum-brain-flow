import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  targetStage: string;
  onComplete: () => void;
}

export function HandoffTemplateDialog({ open, onOpenChange, leadId, targetStage, onComplete }: Props) {
  const { user } = useAuth();
  const { companyId } = useCompanyId();
  const { toast } = useToast();

  const [scope, setScope] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [filesNeeded, setFilesNeeded] = useState("");
  const [blockers, setBlockers] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!scope.trim()) return;
    setSaving(true);
    try {
      const body = [
        `**Handoff to ${targetStage}**`,
        `**Scope:** ${scope.trim()}`,
        `**Target Date:** ${dueDate}`,
        filesNeeded.trim() ? `**Files Needed:** ${filesNeeded.trim()}` : null,
        blockers.trim() ? `**Blockers:** ${blockers.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const { error } = await supabase.from("lead_activities").insert({
        lead_id: leadId,
        company_id: companyId!,
        activity_type: "internal_note",
        title: `Handoff: ${targetStage}`,
        description: body,
        created_by: user?.id ?? null,
        completed_at: new Date().toISOString(),
      });
      if (error) throw error;

      toast({ title: "Handoff note saved" });
      onComplete();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" /> QC / Estimation Handoff
          </DialogTitle>
          <DialogDescription>
            Provide handoff details before routing to {targetStage}. This creates a structured note on the lead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Scope Summary *</Label>
            <Textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="e.g. Foundation rebar for 3-storey residential, 450m² slab"
              rows={3}
            />
          </div>
          <div>
            <Label>Target Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label>Files Needed</Label>
            <Input
              value={filesNeeded}
              onChange={(e) => setFilesNeeded(e.target.value)}
              placeholder="e.g. Structural drawings rev C, soil report"
            />
          </div>
          <div>
            <Label>Blockers / Notes</Label>
            <Input
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="e.g. Waiting on updated specs from engineer"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !scope.trim()}>
            {saving ? "Saving…" : "Save & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
