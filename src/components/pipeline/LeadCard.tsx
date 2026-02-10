import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, DollarSign, Calendar, Building, AlertTriangle, Clock, Mail, Star, MessageSquare } from "lucide-react";
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

function getCardSignal(lead: Lead): { border: string; dot: string; label: string } {
  const now = new Date();
  const daysSinceUpdate = differenceInDays(now, new Date(lead.updated_at));

  if (lead.stage === "won") {
    return { border: "border-l-emerald-500", dot: "bg-emerald-500", label: "Won" };
  }
  if (lead.stage === "lost") {
    return { border: "border-l-zinc-400", dot: "bg-zinc-400", label: "Lost" };
  }

  const isOverdue = lead.expected_close_date && new Date(lead.expected_close_date) < now;
  const isDueSoon = lead.expected_close_date && differenceInDays(new Date(lead.expected_close_date), now) <= 7 && !isOverdue;
  const daysOverdue = isOverdue ? differenceInDays(now, new Date(lead.expected_close_date!)) : 0;

  if ((isOverdue && daysSinceUpdate >= 7) || daysOverdue >= 30) {
    return { border: "border-l-red-500", dot: "bg-red-500", label: "Overdue" };
  }
  if (isDueSoon || (isOverdue && daysSinceUpdate < 7) || (lead.priority === "high" && daysSinceUpdate >= 5)) {
    return { border: "border-l-orange-500", dot: "bg-orange-500", label: isDueSoon ? "Due soon" : isOverdue ? "Past due" : "Needs action" };
  }
  if (lead.priority === "high" && daysSinceUpdate >= 2) {
    return { border: "border-l-yellow-500", dot: "bg-yellow-500", label: "High priority" };
  }
  if (lead.priority === "medium" && daysSinceUpdate >= 7) {
    return { border: "border-l-yellow-500", dot: "bg-yellow-500", label: "Needs attention" };
  }
  if ((lead.probability !== null && lead.probability >= 70) || (lead.priority === "high" && daysSinceUpdate < 2)) {
    return { border: "border-l-green-500", dot: "bg-green-500", label: "On track" };
  }
  if (daysSinceUpdate < 5) {
    return { border: "border-l-blue-500", dot: "bg-blue-500", label: "Active" };
  }
  return { border: "border-l-muted-foreground/30", dot: "bg-muted-foreground/50", label: "Inactive" };
}

// Derive priority stars (0-3) from lead priority
function getPriorityStars(lead: Lead): number {
  const meta = lead.metadata as Record<string, unknown> | null;
  // Odoo priority: "0"=normal, "1"=low, "2"=high, "3"=very high
  const odooPriority = meta?.odoo_priority as string | undefined;
  if (odooPriority) return Math.min(parseInt(odooPriority) || 0, 3);
  if (lead.priority === "high") return 3;
  if (lead.priority === "medium") return 2;
  return 0;
}

// Get salesperson initials & color from metadata or notes
function getSalesperson(lead: Lead): { name: string; initials: string; color: string } | null {
  const meta = lead.metadata as Record<string, unknown> | null;
  const name = (meta?.odoo_salesperson as string) || null;
  if (!name) {
    // Fallback: parse from notes
    const match = lead.notes?.match(/Salesperson:\s*([^|]+)/);
    if (!match) return null;
    const n = match[1].trim();
    return { name: n, initials: getInitials(n), color: getNameColor(n) };
  }
  return { name, initials: getInitials(name), color: getNameColor(name) };
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-purple-500",
  "bg-pink-500", "bg-teal-500", "bg-red-500", "bg-amber-500",
  "bg-cyan-500", "bg-indigo-500",
];

function getNameColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function LeadCard({ lead, onDragStart, onDragEnd, onEdit, onDelete, onClick }: LeadCardProps) {
  const signal = getCardSignal(lead);
  const stars = getPriorityStars(lead);
  const salesperson = getSalesperson(lead);
  const meta = lead.metadata as Record<string, unknown> | null;
  const hasEmail = !!(meta?.odoo_email || meta?.subject);
  const revenue = (meta?.odoo_revenue as number) || lead.expected_value || 0;
  const customerName = lead.customers?.company_name || lead.customers?.name || null;

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
      <CardContent className="p-3 space-y-1.5">
        {/* Title */}
        <div className="flex items-start justify-between gap-1">
          <p className="font-medium text-sm leading-tight line-clamp-2 flex-1 min-w-0">{lead.title}</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(lead); }}>
                <Pencil className="w-3 h-3 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }} className="text-destructive">
                <Trash2 className="w-3 h-3 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Customer name */}
        {customerName && (
          <p className="text-xs text-muted-foreground truncate">{customerName}</p>
        )}

        {/* Revenue if present */}
        {revenue > 0 && (
          <p className="text-xs font-semibold text-foreground">
            {revenue.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 })}
          </p>
        )}

        {/* Bottom row: stars, icons, salesperson badge */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {/* Star rating */}
            <div className="flex items-center gap-px">
              {[1, 2, 3].map((i) => (
                <Star
                  key={i}
                  className={cn(
                    "w-3 h-3",
                    i <= stars ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"
                  )}
                />
              ))}
            </div>

            {/* Activity icons */}
            {hasEmail && <Mail className="w-3 h-3 text-muted-foreground" />}
            {lead.notes && <MessageSquare className="w-3 h-3 text-muted-foreground" />}
          </div>

          {/* Salesperson badge */}
          {salesperson && (
            <div
              className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0", salesperson.color)}
              title={salesperson.name}
            >
              {salesperson.initials}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
