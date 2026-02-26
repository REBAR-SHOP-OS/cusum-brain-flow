import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MachineOption, CutPlanItem, CutPlan } from "@/hooks/useCutPlans";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface QueueToMachineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: CutPlan;
  items: CutPlanItem[];
  machines: MachineOption[];
  onQueued: () => void;
}

export function QueueToMachineDialog({
  open, onOpenChange, plan, items, machines, onQueued
}: QueueToMachineDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [machineId, setMachineId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cutterMachines = machines.filter(m => m.status !== "down");

  const handleQueue = async () => {
    if (!machineId || items.length === 0) return;
    setSubmitting(true);

    try {
      const selectedMachine = machines.find(m => m.id === machineId);

      // Get company_id from the machine
      const companyId = selectedMachine?.company_id;
      if (!companyId) throw new Error("Machine company not found");

      // Create machine_runs for each item
      const runs = items.map(item => ({
        company_id: companyId,
        machine_id: machineId,
        process: "cut" as const,
        status: "queued" as const,
        input_qty: item.qty_bars,
        notes: `cut_plan_id:${plan.id} | ${item.bar_code} x${item.qty_bars} @ ${item.cut_length_mm}mm`,
        created_by: user?.id || null,
      }));

      const { error: runsError } = await supabase.from("machine_runs").insert(runs);
      if (runsError) throw runsError;

      // Write event
      const { error: eventError } = await supabase.from("activity_events").insert({
        entity_type: "cut_plan",
        entity_id: plan.id,
        event_type: "cut_plan_queued",
        actor_id: user?.id || null,
        actor_type: "user",
        description: `Cut plan "${plan.name}" queued to ${selectedMachine?.name || "machine"} with ${items.length} items`,
        company_id: companyId!,
        source: "system",
        dedupe_key: `cut_plan_queued:${plan.id}:${machineId}`,
        metadata: {
          machine_id: machineId,
          machine_name: selectedMachine?.name,
          item_count: items.length,
          total_bars: items.reduce((sum, i) => sum + i.qty_bars, 0),
        },
      });
      if (eventError) console.error("Event write failed:", eventError);

      // Update plan status to queued
      await supabase.from("cut_plans").update({ status: "queued", machine_id: machineId }).eq("id", plan.id);

      toast({ title: "Plan queued", description: `${items.length} items queued to ${selectedMachine?.name}` });
      onQueued();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Queue failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Queue to Machine</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Queue <strong>{items.length}</strong> item(s) from <strong>{plan.name}</strong> to a cutter machine.
          </p>

          <div className="space-y-1">
            <Label className="text-xs">Select Machine</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a cutter…" />
              </SelectTrigger>
              <SelectContent>
                {cutterMachines.length === 0 ? (
                  <SelectItem value="none" disabled>No cutter machines available</SelectItem>
                ) : (
                  cutterMachines.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} {m.model ? `(${m.model})` : ""} — {m.status}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="text-xs text-muted-foreground border-t border-border pt-2">
            Total bars: {items.reduce((sum, i) => sum + i.qty_bars, 0)} •
            Items: {items.length}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleQueue}
            disabled={!machineId || submitting || items.length === 0}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Queue {items.length} items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
