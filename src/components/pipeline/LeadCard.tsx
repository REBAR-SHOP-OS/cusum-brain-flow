import { Card, CardContent } from "@/components/ui/card";
import { Star, Clock, Mail } from "lucide-react";
import { differenceInDays } from "date-fns";
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

// Odoo-style activity status: overdue=red, today=orange, future=green, none=grey
function getActivityStatus(lead: Lead): { color: string; label: string } | null {
  if (lead.stage === "won" || lead.stage === "lost") return null;
  if (!lead.expected_close_date) return null;
  const now = new Date();
  const closeDate = new Date(lead.expected_close_date);
  const diff = differenceInDays(closeDate, now);
  if (diff < 0) return { color: "text-red-500", label: "Overdue" };
  if (diff === 0) return { color: "text-orange-500", label: "Today" };
  return { color: "text-green-500", label: "Planned" };
}

// Derive priority stars (0-3) from lead priority
function getPriorityStars(lead: Lead): number {
  const meta = lead.metadata as Record<string, unknown> | null;
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
  const stars = getPriorityStars(lead);
  const salesperson = getSalesperson(lead);
  const meta = lead.metadata as Record<string, unknown> | null;
  const revenue = (meta?.odoo_revenue as number) || lead.expected_value || 0;
  const customerName = lead.customers?.company_name || lead.customers?.name || null;
  const displayTitle = lead.title.replace(/^S\d+,\s*/, "");
  const activity = getActivityStatus(lead);
  const isEmailSource = lead.source?.startsWith("Email") || lead.source === "rfq_scan";

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(lead)}
      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-all"
    >
      <CardContent className="p-3 space-y-1.5">
        {/* Title + email source badge */}
        <div className="flex items-start gap-1">
          <p className="font-medium text-sm leading-tight line-clamp-2 flex-1">{displayTitle}</p>
          {isEmailSource && (
            <span title="Email-sourced (ERP only)" className="shrink-0 mt-0.5">
              <Mail className="w-3 h-3 text-muted-foreground" />
            </span>
          )}
        </div>

        {/* Customer name */}
        {customerName && (
          <p className="text-xs text-muted-foreground truncate">{customerName}</p>
        )}

        {/* Bottom row: stars, activity dot, revenue, salesperson */}
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

            {/* Odoo activity status indicator */}
            {activity && (
              <span title={activity.label}>
                <Clock className={cn("w-3.5 h-3.5", activity.color)} />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Revenue — Odoo format */}
            {revenue > 0 && (
              <span className="text-xs font-semibold text-foreground">
                $ {revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}

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
        </div>
      </CardContent>
    </Card>
  );
}
