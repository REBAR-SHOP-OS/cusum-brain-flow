import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare, Phone, Mail, Calendar, Clock, Send,
  CheckCircle2, Loader2, ArrowRight, Zap,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useSalesLeadActivities, type SalesLeadActivity } from "@/hooks/useSalesLeadActivities";

interface Props {
  salesLeadId: string;
  companyId: string;
}

type TabMode = "note" | "activity" | null;
type ThreadFilter = "all" | "notes" | "system";

const activityIcons: Record<string, React.ElementType> = {
  note: MessageSquare,
  call: Phone,
  email: Mail,
  meeting: Calendar,
  follow_up: Clock,
  stage_change: ArrowRight,
  system: Zap,
};

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

export function SalesLeadChatter({ salesLeadId, companyId }: Props) {
  const { activities, isLoading, create, markDone } = useSalesLeadActivities(salesLeadId);
  const [activeTab, setActiveTab] = useState<TabMode>(null);
  const [text, setText] = useState("");
  const [activityType, setActivityType] = useState("follow_up");
  const [dueDate, setDueDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [filter, setFilter] = useState<ThreadFilter>("all");

  const handleSubmit = () => {
    if (!text.trim()) return;
    if (activeTab === "note") {
      create.mutate({
        sales_lead_id: salesLeadId,
        company_id: companyId,
        activity_type: "note",
        body: text,
      }, { onSuccess: () => { setText(""); setActiveTab(null); } });
    } else if (activeTab === "activity") {
      create.mutate({
        sales_lead_id: salesLeadId,
        company_id: companyId,
        activity_type: activityType,
        subject: text,
        scheduled_date: dueDate,
      }, { onSuccess: () => { setText(""); setActiveTab(null); } });
    }
  };

  const filtered = activities.filter((a) => {
    if (filter === "notes") return a.activity_type === "note" || a.activity_type === "email";
    if (filter === "system") return a.activity_type === "stage_change" || a.activity_type === "system";
    return true;
  });

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Action buttons */}
      <div className="flex gap-1.5">
        {(["note", "activity"] as const).map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={activeTab === tab ? "default" : "outline"}
            className="h-7 text-[11px] gap-1 capitalize"
            onClick={() => setActiveTab(activeTab === tab ? null : tab)}
          >
            {tab === "note" ? <MessageSquare className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
            {tab === "note" ? "Log note" : "Schedule activity"}
          </Button>
        ))}
      </div>

      {/* Composer */}
      {activeTab && (
        <div className="rounded-lg border border-border p-3 space-y-2 bg-accent/30">
          {activeTab === "activity" && (
            <div className="flex gap-2">
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">📞 Call</SelectItem>
                  <SelectItem value="email">✉️ Email</SelectItem>
                  <SelectItem value="meeting">📅 Meeting</SelectItem>
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
          )}
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={activeTab === "note" ? "Write a note..." : "Activity description..."}
            rows={3}
            className="text-sm resize-none"
          />
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => { setActiveTab(null); setText(""); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!text.trim() || create.isPending}
              className="gap-1.5"
            >
              {create.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              {activeTab === "note" ? "Log" : "Schedule"}
            </Button>
          </div>
        </div>
      )}

      {/* Thread filter */}
      <div className="flex gap-1 border-b border-border pb-1">
        {(["all", "notes", "system"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-2 py-1 text-[11px] font-medium rounded-sm capitalize transition-colors",
              filter === f
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Activity Feed */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-[13px] text-muted-foreground">
          No activities yet. Log a note to get started.
        </div>
      ) : (
        <div className="space-y-0">
          {filtered.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} onMarkDone={() => markDone.mutate(activity.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityItem({ activity, onMarkDone }: { activity: SalesLeadActivity; onMarkDone: () => void }) {
  const Icon = activityIcons[activity.activity_type] || MessageSquare;
  const isScheduled = !!activity.scheduled_date && !activity.completed_at;
  const initials = activity.user_name ? getInitials(activity.user_name) : "??";

  return (
    <div className="flex gap-3 py-2.5 border-b border-border/50 last:border-0 group">
      <Avatar className="h-7 w-7 mt-0.5 shrink-0">
        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{activity.user_name || "System"}</span>
          <span>·</span>
          <Icon className="w-3 h-3" />
          <span className="capitalize">{activity.activity_type.replace("_", " ")}</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</span>
        </div>
        {activity.subject && (
          <p className="text-[13px] font-medium mt-0.5">{activity.subject}</p>
        )}
        {activity.body && (
          <p className="text-[13px] text-muted-foreground mt-0.5 whitespace-pre-wrap">{activity.body}</p>
        )}
        {isScheduled && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-muted-foreground">
              Due: {format(new Date(activity.scheduled_date + "T00:00:00"), "MMM d, yyyy")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] px-1.5 text-green-600 hover:text-green-700 hover:bg-green-500/10"
              onClick={onMarkDone}
            >
              <CheckCircle2 className="w-3 h-3 mr-0.5" />
              Done
            </Button>
          </div>
        )}
        {activity.completed_at && (
          <span className="text-[10px] text-green-600 flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3 h-3" />
            Completed {format(new Date(activity.completed_at), "MMM d")}
          </span>
        )}
      </div>
    </div>
  );
}
