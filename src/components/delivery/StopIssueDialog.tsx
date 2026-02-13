import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface StopIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stopId: string;
  onComplete: () => void;
}

export function StopIssueDialog({ open, onOpenChange, stopId, onComplete }: StopIssueDialogProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Fix 4: Reset reason when dialog closes
  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("delivery_stops")
        .update({
          status: "failed",
          exception_reason: reason.trim(),
        })
        .eq("id", stopId);
      if (error) throw error;

      toast.success("Issue logged");
      onComplete();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to log issue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Log Delivery Issue
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the issue (e.g., customer not available, wrong address, damaged goods...)"
            rows={4}
          />
          <Button
            onClick={handleSubmit}
            disabled={saving || !reason.trim()}
            variant="destructive"
            className="w-full gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            Log Issue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

StopIssueDialog.displayName = "StopIssueDialog";
