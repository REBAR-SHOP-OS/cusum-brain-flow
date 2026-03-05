import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useScheduledActivities } from "@/hooks/useScheduledActivities";
import { CalendarClock } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onComplete: () => void;
}

const ACTIVITY_TYPES = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "follow_up", label: "Follow-up" },
  { value: "site_visit", label: "Site Visit" },
  { value: "other", label: "Other" },
];

export function NextActivityGateModal({ open, onOpenChange, leadId, onComplete }: Props) {
  const [activityType, setActivityType] = useState("follow_up");
  const [summary, setSummary] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);

  const { createActivity, planned } = useScheduledActivities("lead", leadId);

  // If user already has a future activity, allow them to skip
  const hasFutureActivity = planned.some(
    (a) => new Date(a.due_date) >= new Date(new Date().toISOString().slice(0, 10))
  );

  const handleSubmit = async () => {
    if (hasFutureActivity) {
      onComplete();
      return;
    }
    if (!summary.trim()) return;
    setSaving(true);
    try {
      await createActivity.mutateAsync({
        entity_type: "lead",
        entity_id: leadId,
        activity_type: activityType,
        summary: summary.trim(),
        due_date: dueDate,
      });
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" /> Schedule Next Activity
          </DialogTitle>
          <DialogDescription>
            A follow-up activity is required before moving this lead forward. Schedule one to continue.
          </DialogDescription>
        </DialogHeader>

        {hasFutureActivity ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              ✅ This lead already has {planned.length} scheduled activit{planned.length === 1 ? "y" : "ies"}.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Activity Type</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Summary</Label>
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g. Follow up on quotation request"
              />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || (!hasFutureActivity && !summary.trim())}>
            {hasFutureActivity ? "Continue" : saving ? "Saving…" : "Schedule & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
