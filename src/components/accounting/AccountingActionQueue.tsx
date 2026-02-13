import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Bot, Check, X, Calendar, Edit3, Mail, Phone, Send, AlertTriangle,
  ChevronDown, ChevronUp, Loader2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePennyQueue, type PennyQueueItem } from "@/hooks/usePennyQueue";

const ACTION_LABELS: Record<string, { label: string; icon: typeof Mail }> = {
  email_reminder: { label: "Email Reminder", icon: Mail },
  call_collection: { label: "Collection Call", icon: Phone },
  send_invoice: { label: "Re-send Invoice", icon: Send },
  escalate: { label: "Escalate to CEO", icon: AlertTriangle },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-warning/10 text-warning border-warning/30",
  medium: "bg-primary/10 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground border-border",
};

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_approval: { label: "Pending", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  executed: { label: "Executed", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
};

function ActionCard({ item, onApprove, onReject, onSchedule }: {
  item: PennyQueueItem;
  onApprove: (id: string, payload?: Record<string, unknown>) => void;
  onReject: (id: string, reason?: string) => void;
  onSchedule: (id: string, date: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(
    (item.action_payload?.email_body as string) || (item.action_payload?.call_script as string) || ""
  );
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");

  const actionMeta = ACTION_LABELS[item.action_type] || ACTION_LABELS.email_reminder;
  const Icon = actionMeta.icon;
  const isPending = item.status === "pending_approval";
  const statusMeta = STATUS_BADGES[item.status] || STATUS_BADGES.pending_approval;

  return (
    <Card className={cn("border transition-all", isPending ? PRIORITY_COLORS[item.priority] : "opacity-70")}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{item.customer_name}</p>
              <p className="text-xs text-muted-foreground">
                ${item.amount.toLocaleString()} • {item.days_overdue}d overdue • {actionMeta.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={statusMeta.variant} className="text-[10px]">{statusMeta.label}</Badge>
            <Badge variant="outline" className="text-[10px] capitalize">{item.priority}</Badge>
          </div>
        </div>

        {/* AI Reasoning */}
        {item.ai_reasoning && (
          <div className="flex items-start gap-2 text-xs bg-background/50 rounded-lg p-2.5">
            <Bot className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
            <p className="text-muted-foreground">{item.ai_reasoning}</p>
          </div>
        )}

        {/* Expandable draft */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide draft" : "View draft"}
        </button>

        {expanded && (
          <div className="space-y-2">
            {editing ? (
              <Textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                className="text-xs min-h-[100px]"
              />
            ) : (
              <div className="text-xs bg-background rounded-lg p-3 border whitespace-pre-wrap max-h-48 overflow-y-auto">
                {(item.action_payload?.email_body as string) || (item.action_payload?.call_script as string) || "No draft available"}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {editing ? (
              <>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => {
                  const key = item.action_type === "call_collection" ? "call_script" : "email_body";
                  onApprove(item.id, { ...item.action_payload, [key]: editedBody });
                  setEditing(false);
                }}>
                  <Check className="w-3 h-3" /> Save & Approve
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
              </>
            ) : (
              <>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onApprove(item.id)}>
                  <Check className="w-3 h-3" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setExpanded(true); setEditing(true); }}>
                  <Edit3 className="w-3 h-3" /> Edit & Approve
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowSchedule(!showSchedule)}>
                  <Calendar className="w-3 h-3" /> Schedule
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive" onClick={() => setShowReject(!showReject)}>
                  <X className="w-3 h-3" /> Reject
                </Button>
              </>
            )}
          </div>
        )}

        {/* Reject form */}
        {showReject && (
          <div className="flex gap-2 items-end">
            <Input
              placeholder="Reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs h-8"
            />
            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => {
              onReject(item.id, rejectReason);
              setShowReject(false);
            }}>
              Dismiss
            </Button>
          </div>
        )}

        {/* Schedule form */}
        {showSchedule && (
          <div className="flex gap-2 items-end">
            <Input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="text-xs h-8"
            />
            <Button size="sm" className="h-8 text-xs" disabled={!scheduleDate} onClick={() => {
              onSchedule(item.id, scheduleDate);
              setShowSchedule(false);
            }}>
              Set
            </Button>
          </div>
        )}

        {/* Follow-up info */}
        {item.followup_date && (
          <p className="text-[10px] text-muted-foreground">
            📅 Follow-up: {item.followup_date} • Attempt #{item.followup_count}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
ActionCard.displayName = "ActionCard";

export function AccountingActionQueue() {
  const { pendingItems, items, loading, approve, reject, schedule, triggerAutoActions } = usePennyQueue();
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const displayItems = filter === "pending" ? pendingItems : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            AI Actions Queue
          </h2>
          <p className="text-sm text-muted-foreground">
            {pendingItems.length} pending approval{pendingItems.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "pending" ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setFilter("pending")}
          >
            Pending ({pendingItems.length})
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setFilter("all")}
          >
            All ({items.length})
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={triggerAutoActions} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Scan Now
          </Button>
        </div>
      </div>

      {loading && displayItems.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && displayItems.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Bot className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No actions in queue</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Scan Now" to have Penny analyze overdue invoices
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {displayItems.map(item => (
          <ActionCard
            key={item.id}
            item={item}
            onApprove={approve}
            onReject={reject}
            onSchedule={schedule}
          />
        ))}
      </div>
    </div>
  );
}

AccountingActionQueue.displayName = "AccountingActionQueue";
