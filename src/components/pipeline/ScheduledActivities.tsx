import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Phone, Mail, Calendar, Clock, CheckCircle2, Plus, Send,
  X, Loader2, AlertCircle,
} from "lucide-react";
import { format, isBefore, isToday, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useScheduledActivities, type ScheduledActivity } from "@/hooks/useScheduledActivities";

interface ScheduledActivitiesProps {
  entityType: string;
  entityId: string;
}

const typeIcons: Record<string, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  todo: CheckCircle2,
  follow_up: Clock,
};

const typeLabels: Record<string, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  todo: "To-Do",
  follow_up: "Follow-up",
};

export function ScheduledActivities({ entityType, entityId }: ScheduledActivitiesProps) {
  const { planned, done, isLoading, createActivity, markDone, cancelActivity } = useScheduledActivities(entityType, entityId);
  const [showForm, setShowForm] = useState(false);
  const [activityType, setActivityType] = useState("call");
  const [summary, setSummary] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  const handleSubmit = () => {
    if (!summary.trim()) return;
    createActivity.mutate(
      {
        entity_type: entityType,
        entity_id: entityId,
        activity_type: activityType,
        summary,
        note: note || undefined,
        due_date: dueDate,
      },
      {
        onSuccess: () => {
          setSummary("");
          setNote("");
          setShowForm(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Schedule button */}
      {!showForm && (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="w-full gap-1.5 rounded-sm text-[13px]">
          <Plus className="w-3.5 h-3.5" />
          Schedule Activity
        </Button>
      )}

      {/* Create form */}
      {showForm && (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-accent/30">
          <div className="flex gap-2">
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">📞 Call</SelectItem>
                <SelectItem value="email">✉️ Email</SelectItem>
                <SelectItem value="meeting">📅 Meeting</SelectItem>
                <SelectItem value="todo">✅ To-Do</SelectItem>
                <SelectItem value="follow_up">⏰ Follow-up</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-36 h-8 text-xs"
            />
          </div>
          <Input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Activity summary..."
            className="h-8 text-sm"
          />
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Additional notes (optional)..."
            rows={2}
            className="text-sm resize-none"
          />
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!summary.trim() || createActivity.isPending} className="gap-1.5">
              <Send className="w-3 h-3" />
              Schedule
            </Button>
          </div>
        </div>
      )}

      {/* Planned Activities */}
      {planned.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Planned ({planned.length})
          </h4>
          <div className="space-y-1.5">
            {planned.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onMarkDone={() => markDone.mutate(activity.id)}
                onCancel={() => cancelActivity.mutate(activity.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {done.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Completed ({done.length})
          </h4>
          <div className="space-y-1">
            {done.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-center gap-2 py-1.5 px-2 rounded text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <span className="truncate flex-1">{activity.summary}</span>
                <span className="shrink-0">{format(new Date(activity.completed_at!), "MMM d")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {planned.length === 0 && done.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="w-16 h-16 text-muted-foreground/20 mb-3" />
          <p className="text-[13px] text-muted-foreground">
            No activities yet.
          </p>
          <p className="text-[13px] text-muted-foreground">
            Schedule an activity to get started.
          </p>
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  activity,
  onMarkDone,
  onCancel,
}: {
  activity: ScheduledActivity;
  onMarkDone: () => void;
  onCancel: () => void;
}) {
  const Icon = typeIcons[activity.activity_type] || Clock;
  const label = typeLabels[activity.activity_type] || activity.activity_type;
  const due = new Date(activity.due_date + "T00:00:00");
  const overdue = isBefore(due, startOfDay(new Date()));
  const today = isToday(due);

  return (
    <div className="flex items-start gap-3 p-2.5 rounded-md border border-border hover:bg-accent/50 transition-colors group">
      <div
        className={cn(
          "mt-0.5 shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded",
          overdue
            ? "bg-destructive/10 text-destructive"
            : today
            ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
            : "bg-green-500/10 text-green-600 dark:text-green-400"
        )}
      >
        {format(due, "MMM d")}
      </div>
      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-medium truncate">{activity.summary}</p>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{label}</Badge>
          {overdue && (
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
          )}
        </div>
        {activity.note && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{activity.note}</p>
        )}
        {activity.assigned_name && (
          <p className="text-[11px] text-muted-foreground">{activity.assigned_name}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] px-2 text-green-600 hover:text-green-700 hover:bg-green-500/10"
          onClick={onMarkDone}
        >
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Done
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] px-1.5 text-muted-foreground hover:text-destructive"
          onClick={onCancel}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
