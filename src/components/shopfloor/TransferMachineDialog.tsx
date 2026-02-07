import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight } from "lucide-react";
import type { StationItem } from "@/hooks/useStationData";

interface TransferMachineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StationItem;
  /** Current machine type so we show machines of the same type */
  machineType: string;
  currentMachineId: string;
}

export function TransferMachineDialog({
  open,
  onOpenChange,
  item,
  machineType,
  currentMachineId,
}: TransferMachineDialogProps) {
  const { machines } = useLiveMonitorData();
  const { toast } = useToast();
  const [transferring, setTransferring] = useState(false);

  // Show machines of the same type, excluding current
  const availableMachines = machines.filter(
    (m) => m.type === machineType && m.id !== currentMachineId
  );

  const handleTransfer = async (targetMachineId: string) => {
    setTransferring(true);
    try {
      const targetMachine = machines.find((m) => m.id === targetMachineId);

      // Find or create a cut plan on the target machine
      const { data: existingPlans } = await supabase
        .from("cut_plans")
        .select("id")
        .eq("machine_id", targetMachineId)
        .in("status", ["draft", "queued", "running"])
        .limit(1);

      let targetPlanId: string;

      if (existingPlans && existingPlans.length > 0) {
        targetPlanId = existingPlans[0].id;
      } else {
        // Create a new plan on the target machine
        const { data: planData } = await supabase
          .from("cut_plans")
          .select("company_id, project_id, project_name")
          .eq("id", item.cut_plan_id)
          .single();

        const { data: newPlan, error: createError } = await supabase
          .from("cut_plans")
          .insert({
            company_id: planData?.company_id || "",
            machine_id: targetMachineId,
            name: `Transfer to ${targetMachine?.name || "machine"}`,
            project_id: planData?.project_id,
            project_name: planData?.project_name,
            status: "queued",
          })
          .select("id")
          .single();

        if (createError) throw createError;
        targetPlanId = newPlan!.id;
      }

      // Move the item to the target plan
      const { error: moveError } = await supabase
        .from("cut_plan_items")
        .update({ cut_plan_id: targetPlanId } as any)
        .eq("id", item.id);

      if (moveError) throw moveError;

      toast({
        title: "Transferred",
        description: `${item.mark_number || "Item"} moved to ${targetMachine?.name || "target machine"}`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Item</DialogTitle>
          <DialogDescription>
            Move <strong>{item.mark_number || "this item"}</strong> ({item.bar_code}) to another machine
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2">
          {availableMachines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No other {machineType} machines available
            </p>
          ) : (
            availableMachines.map((m) => (
              <Button
                key={m.id}
                variant="outline"
                className="w-full justify-between h-auto py-3"
                disabled={transferring}
                onClick={() => handleTransfer(m.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold">{m.name}</span>
                  {m.model && (
                    <span className="text-xs text-muted-foreground">{m.model}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      m.status === "idle"
                        ? "border-green-500/30 text-green-600"
                        : m.status === "running"
                        ? "border-primary/30 text-primary"
                        : "border-destructive/30 text-destructive"
                    }`}
                  >
                    {m.status.toUpperCase()}
                  </Badge>
                  {transferring ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
