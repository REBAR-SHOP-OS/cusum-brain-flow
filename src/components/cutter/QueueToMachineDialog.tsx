import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MachineOption, CutPlanItem, CutPlan } from "@/hooks/useCutPlans";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Loader2, SplitSquareVertical } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const [machineId, setMachineId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Capability validation state
  const [allowedBarCodes, setAllowedBarCodes] = useState<string[]>([]);
  const [compatibleItems, setCompatibleItems] = useState<CutPlanItem[]>([]);
  const [incompatibleItems, setIncompatibleItems] = useState<CutPlanItem[]>([]);
  const [loadingCaps, setLoadingCaps] = useState(false);

  const cutterMachines = machines.filter(m => m.status !== "down");

  // Fetch capabilities when machine changes
  useEffect(() => {
    if (!machineId) {
      setAllowedBarCodes([]);
      setCompatibleItems(items);
      setIncompatibleItems([]);
      return;
    }

    setLoadingCaps(true);
    supabase
      .from("machine_capabilities")
      .select("bar_code")
      .eq("machine_id", machineId)
      .eq("process", "cut")
      .then(({ data }) => {
        const codes = (data || []).map(c => c.bar_code);
        setAllowedBarCodes(codes);

        const compat = items.filter(i => codes.includes(i.bar_code));
        const incompat = items.filter(i => !codes.includes(i.bar_code));
        setCompatibleItems(compat);
        setIncompatibleItems(incompat);
        setLoadingCaps(false);
      });
  }, [machineId, items]);

  // Find the other cutter machine for auto-split
  const findOtherMachine = () => {
    return cutterMachines.find(m => m.id !== machineId) || null;
  };

  const handleQueue = async () => {
    if (!machineId || compatibleItems.length === 0) return;
    setSubmitting(true);

    try {
      const selectedMachine = machines.find(m => m.id === machineId);
      const companyId = selectedMachine?.company_id;
      if (!companyId) throw new Error("Machine company not found");

      // --- Auto-split incompatible items to the other machine ---
      if (incompatibleItems.length > 0) {
        const otherMachine = findOtherMachine();
        if (!otherMachine) throw new Error("No other cutter machine available for split");

        // Create a new plan for the split items
        const { data: splitPlan, error: splitErr } = await supabase
          .from("cut_plans")
          .insert({
            name: `${plan.name} (Auto-Split)`,
            company_id: companyId,
            created_by: user?.id || null,
            project_id: plan.project_id,
            status: "queued",
            machine_id: otherMachine.id,
          })
          .select()
          .single();
        if (splitErr) throw splitErr;

        // Move incompatible items to the split plan
        const incompatIds = incompatibleItems.map(i => i.id);
        const { error: moveErr } = await supabase
          .from("cut_plan_items")
          .update({ cut_plan_id: splitPlan.id })
          .in("id", incompatIds);
        if (moveErr) throw moveErr;

        // Create machine_runs for the split plan
        const splitRuns = incompatibleItems.map(item => ({
          company_id: companyId,
          machine_id: otherMachine.id,
          process: "cut" as const,
          status: "queued" as const,
          input_qty: item.qty_bars,
          notes: `cut_plan_id:${splitPlan.id} | ${item.bar_code} x${item.qty_bars} @ ${item.cut_length_mm}${(item as any).unit_system === "in" || (item as any).unit_system === "imperial" ? '"' : (item as any).unit_system === "ft" ? "'" : "mm"}`,
          created_by: user?.id || null,
        }));
        const { error: splitRunsErr } = await supabase.from("machine_runs").insert(splitRuns);
        if (splitRunsErr) throw splitRunsErr;

        // Event for split
        await supabase.from("activity_events").insert({
          entity_type: "cut_plan",
          entity_id: splitPlan.id,
          event_type: "cut_plan_queued",
          actor_id: user?.id || null,
          actor_type: "user",
          description: `Auto-split plan "${splitPlan.name}" queued to ${otherMachine.name} with ${incompatibleItems.length} items`,
          company_id: companyId,
          source: "system",
          dedupe_key: `cut_plan_queued:${splitPlan.id}:${otherMachine.id}`,
          metadata: {
            machine_id: otherMachine.id,
            machine_name: otherMachine.name,
            item_count: incompatibleItems.length,
            total_bars: incompatibleItems.reduce((s, i) => s + i.qty_bars, 0),
            auto_split: true,
            parent_plan_id: plan.id,
          },
        });

        toast({
          title: "Auto-split",
          description: `${incompatibleItems.length} item(s) moved to "${splitPlan.name}" → ${otherMachine.name}`,
        });
      }

      // --- Queue compatible items to selected machine ---
      const runs = compatibleItems.map(item => ({
        company_id: companyId,
        machine_id: machineId,
        process: "cut" as const,
        status: "queued" as const,
        input_qty: item.qty_bars,
        notes: `cut_plan_id:${plan.id} | ${item.bar_code} x${item.qty_bars} @ ${item.cut_length_mm}${(item as any).unit_system === "in" || (item as any).unit_system === "imperial" ? '"' : (item as any).unit_system === "ft" ? "'" : "mm"}`,
        created_by: user?.id || null,
      }));

      const { error: runsError } = await supabase.from("machine_runs").insert(runs);
      if (runsError) throw runsError;

      // Write event
      await supabase.from("activity_events").insert({
        entity_type: "cut_plan",
        entity_id: plan.id,
        event_type: "cut_plan_queued",
        actor_id: user?.id || null,
        actor_type: "user",
        description: `Cut plan "${plan.name}" queued to ${selectedMachine?.name || "machine"} with ${compatibleItems.length} items`,
        company_id: companyId,
        source: "system",
        dedupe_key: `cut_plan_queued:${plan.id}:${machineId}`,
        metadata: {
          machine_id: machineId,
          machine_name: selectedMachine?.name,
          item_count: compatibleItems.length,
          total_bars: compatibleItems.reduce((sum, i) => sum + i.qty_bars, 0),
        },
      });

      // Update plan status to queued
      await supabase.from("cut_plans").update({ status: "queued", machine_id: machineId }).eq("id", plan.id);

      // Auto-update linked work orders to in_progress
      const allItems = [...compatibleItems, ...incompatibleItems];
      const woIds = [...new Set(allItems.map(i => i.work_order_id).filter(Boolean))] as string[];
      if (woIds.length > 0) {
        await supabase
          .from("work_orders")
          .update({ status: "in_progress", actual_start: new Date().toISOString() })
          .in("id", woIds)
          .is("actual_start", null);
        await supabase
          .from("work_orders")
          .update({ status: "in_progress" })
          .in("id", woIds)
          .not("actual_start", "is", null);
        queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      }

      toast({ title: "Plan queued", description: `${compatibleItems.length} items queued to ${selectedMachine?.name}` });
      onQueued();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Queue failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const hasIncompat = incompatibleItems.length > 0;
  const noCompat = machineId && !loadingCaps && compatibleItems.length === 0;
  const otherMachine = hasIncompat ? findOtherMachine() : null;

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

          {/* Incompatible items warning */}
          {hasIncompat && !loadingCaps && (
            <div className="rounded-md border border-accent/30 bg-accent/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div className="text-xs text-accent-foreground">
                  <strong>{incompatibleItems.length}</strong> item(s) ({[...new Set(incompatibleItems.map(i => i.bar_code))].join(", ")}) are <strong>not compatible</strong> with this machine.
                </div>
              </div>
              {otherMachine && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <SplitSquareVertical className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    They will be <strong>auto-split</strong> into a new plan and queued to <strong>{otherMachine.name}</strong>.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* No compatible items error */}
          {noCompat && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-xs text-destructive">
                  <strong>None</strong> of the items in this plan are compatible with this machine. Select a different machine.
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground border-t border-border pt-2">
            {machineId && !loadingCaps ? (
              <>
                Compatible: {compatibleItems.length} items ({compatibleItems.reduce((s, i) => s + i.qty_bars, 0)} bars)
                {hasIncompat && <> • Split: {incompatibleItems.length} items</>}
              </>
            ) : (
              <>Total bars: {items.reduce((sum, i) => sum + i.qty_bars, 0)} • Items: {items.length}</>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleQueue}
            disabled={!machineId || submitting || compatibleItems.length === 0 || loadingCaps}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {hasIncompat && otherMachine
              ? `Queue ${compatibleItems.length} + Split ${incompatibleItems.length}`
              : `Queue ${compatibleItems.length} items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
