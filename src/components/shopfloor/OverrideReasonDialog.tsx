import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export type WorkflowOverrideEntityType =
  | "cut_plan_item"
  | "bundle"
  | "cut_plan"
  | "clearance_evidence";

interface OverrideReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: WorkflowOverrideEntityType;
  entityId: string;
  fromState?: string | null;
  toState: string;
  onSuccess?: () => void;
}

/**
 * Supervisor/admin override dialog. Calls the SECURITY DEFINER RPC
 * `workflow_override_transition` which logs to `workflow_overrides`
 * and bypasses the matching validate_*_transition trigger for this
 * single UPDATE. Reason must be ≥ 10 characters (also enforced server-side).
 */
export function OverrideReasonDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  fromState,
  toState,
  onSuccess,
}: OverrideReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { isAdmin, isShopSupervisor } = useUserRole();
  const canOverride = isAdmin || isShopSupervisor;

  const trimmed = reason.trim();
  const tooShort = trimmed.length < 10;

  const handleConfirm = async () => {
    if (tooShort || !canOverride) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc(
        "workflow_override_transition" as never,
        {
          _entity_type: entityType,
          _entity_id: entityId,
          _to_state: toState,
          _reason: trimmed,
        } as never,
      );
      if (error) throw error;
      toast.success("Override applied", {
        description: `${entityType} → ${toState}`,
      });
      setReason("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Override rejected", { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            Supervisor override
          </DialogTitle>
          <DialogDescription>
            Force {entityType.replace("_", " ")}
            {fromState ? ` from ${fromState}` : ""} → <strong>{toState}</strong>.
            This action is logged to <code>workflow_overrides</code>.
          </DialogDescription>
        </DialogHeader>

        {!canOverride ? (
          <p className="text-sm text-destructive">
            Only admin or shop_supervisor may issue an override.
          </p>
        ) : (
          <div className="space-y-2">
            <Textarea
              autoFocus
              placeholder="Why is this override needed? (min 10 characters)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              disabled={submitting}
            />
            <p
              className={`text-xs ${
                tooShort ? "text-muted-foreground" : "text-emerald-500"
              }`}
            >
              {trimmed.length}/10 characters
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={tooShort || submitting || !canOverride}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Confirm override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OverrideReasonDialog;
