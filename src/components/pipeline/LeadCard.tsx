import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, DollarSign, Calendar, Building, User, AlertTriangle, Clock } from "lucide-react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface LeadCardProps {
  lead: LeadWithCustomer;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onDragEnd: () => void;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onClick: (lead: LeadWithCustomer) => void;
}

/**
 * Kanban color conventions:
 * 🔴 Red    — Urgent, overdue, high risk
 * 🟠 Orange — Due soon, warning
 * 🟡 Yellow — Medium priority, needs attention
 * 🟢 Green  — Normal, progressing, good
 * 🔵 Blue   — Info, category label
 * ⚪ Grey   — Neutral, not yet categorized
 */
function getCardSignal(lead: Lead): { border: string; dot: string; label: string } {
  const now = new Date();
  const daysSinceUpdate = differenceInDays(now, new Date(lead.updated_at));

  // Closed stages — handle first, before any urgency logic
  // 🟢 Green — Won
  if (lead.stage === "won") {
    return { border: "border-l-emerald-500", dot: "bg-emerald-500", label: "Won" };
  }
  // ⚪ Grey — Lost (closed, no action needed)
  if (lead.stage === "lost") {
    return { border: "border-l-zinc-400", dot: "bg-zinc-400", label: "Lost" };
  }

  // Active stages — apply urgency logic
  const isOverdue = lead.expected_close_date && new Date(lead.expected_close_date) < now;
  const isDueSoon = lead.expected_close_date && differenceInDays(new Date(lead.expected_close_date), now) <= 7 && !isOverdue;

  // 🔴 Red — Overdue AND stale (no update in 7+ days) or very overdue (30+ days past)
  const daysOverdue = isOverdue ? differenceInDays(now, new Date(lead.expected_close_date!)) : 0;
  if ((isOverdue && daysSinceUpdate >= 7) || daysOverdue >= 30) {
    return { border: "border-l-red-500", dot: "bg-red-500", label: "Overdue" };
  }
  // 🟠 Orange — Due soon, or overdue but recently touched, or high priority + stale
  if (isDueSoon || (isOverdue && daysSinceUpdate < 7) || (lead.priority === "high" && daysSinceUpdate >= 5)) {
    return { border: "border-l-orange-500", dot: "bg-orange-500", label: isDueSoon ? "Due soon" : isOverdue ? "Past due" : "Needs action" };
  }
  // 🟡 Yellow — High priority active or medium + stale
  if (lead.priority === "high" && daysSinceUpdate >= 2) {
    return { border: "border-l-yellow-500", dot: "bg-yellow-500", label: "High priority" };
  }
  if (lead.priority === "medium" && daysSinceUpdate >= 7) {
    return { border: "border-l-yellow-500", dot: "bg-yellow-500", label: "Needs attention" };
  }
  // 🟢 Green — High probability (≥70) or recently active high priority
  if ((lead.probability !== null && lead.probability >= 70) || (lead.priority === "high" && daysSinceUpdate < 2)) {
    return { border: "border-l-green-500", dot: "bg-green-500", label: "On track" };
  }
  // 🔵 Blue — Normal / active (recently updated)
  if (daysSinceUpdate < 5) {
    return { border: "border-l-blue-500", dot: "bg-blue-500", label: "Active" };
  }
  // ⚪ Grey — Low priority or uncategorized
  return { border: "border-l-muted-foreground/30", dot: "bg-muted-foreground/50", label: "Inactive" };
}

function getProbabilityColor(probability: number): string {
  if (probability >= 70) return "bg-green-500";
  if (probability >= 40) return "bg-yellow-500";
  if (probability >= 15) return "bg-orange-500";
  return "bg-red-500";
}

export function LeadCard({ lead, onDragStart, onDragEnd, onEdit, onDelete, onClick }: LeadCardProps) {
  const parseAssigned = (notes: string | null) => {
    if (!notes) return null;
    const match = notes.match(/Assigned:\s*([^|]+)/);
    return match ? match[1].trim() : null;
  };

  const assigned = parseAssigned(lead.notes);
  const age = formatDistanceToNow(new Date(lead.created_at), { addSuffix: false });
  const signal = getCardSignal(lead);
  const isOverdue = lead.expected_close_date && new Date(lead.expected_close_date) < new Date();
  const daysSinceUpdate = differenceInDays(new Date(), new Date(lead.updated_at));

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(lead)}
      className={cn(
        "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30 transition-all border-l-4 group",
        signal.border
      )}
    >
      <CardContent className="p-3 space-y-2">
        {/* Signal + Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className={cn("w-2 h-2 rounded-full shrink-0", signal.dot)} title={signal.label} />
              {(isOverdue || daysSinceUpdate >= 7) && (
                <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
              )}
            </div>
            <p className="font-medium text-sm leading-tight line-clamp-2">{lead.title}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(lead); }}>
                <Pencil className="w-3 h-3 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
                className="text-destructive"
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Customer */}
        {lead.customers && (
          <div className="flex items-center gap-1.5">
            <Building className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground truncate">
              {lead.customers.company_name || lead.customers.name}
            </p>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {lead.expected_value ? (
            <span className="flex items-center gap-0.5 font-medium text-foreground">
              <DollarSign className="w-3 h-3" />
              {lead.expected_value.toLocaleString()}
            </span>
          ) : null}
          {lead.expected_close_date && (
            <span className={cn(
              "flex items-center gap-0.5",
              isOverdue && "text-destructive font-medium"
            )}>
              <Calendar className="w-3 h-3" />
              {format(new Date(lead.expected_close_date), "MMM d")}
            </span>
          )}
          {assigned && (
            <span className="flex items-center gap-0.5">
              <User className="w-3 h-3" />
              {assigned.split(" ")[0]}
            </span>
          )}
        </div>

        {/* Probability bar + age */}
        {lead.probability !== null && lead.probability !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className={cn(
                "flex items-center gap-1",
                daysSinceUpdate >= 7 ? "text-destructive" : "text-muted-foreground"
              )}>
                {daysSinceUpdate >= 7 && <Clock className="w-3 h-3" />}
                {age}
              </span>
              <span className="font-medium">{lead.probability}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", getProbabilityColor(lead.probability))}
                style={{ width: `${lead.probability}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
