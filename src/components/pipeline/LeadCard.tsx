import { Star, AlignJustify, Mail, Brain, Clock } from "lucide-react";
import { differenceInDays, differenceInHours, formatDistanceToNowStrict, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { LeadScoreBreakdown } from "./LeadScoreBreakdown";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface LeadCardProps {
  lead: LeadWithCustomer;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onDragEnd: () => void;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onClick: (lead: LeadWithCustomer) => void;
  hasAIAction?: boolean;
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
  const hasOdooId = !!meta?.odoo_id;
  const odooPriority = meta?.odoo_priority as string | undefined;
  if (odooPriority !== undefined && odooPriority !== null) {
    return Math.min(parseInt(odooPriority) || 0, 3);
  }
  if (hasOdooId) return 0;
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

// SLA countdown helper
function getSlaInfo(lead: Lead): { label: string; urgent: boolean; breached: boolean } | null {
  if (!lead.sla_deadline || lead.stage === "won" || lead.stage === "lost") return null;
  if (lead.sla_breached) return { label: "SLA Breached", urgent: true, breached: true };
  const hoursLeft = differenceInHours(new Date(lead.sla_deadline), new Date());
  if (hoursLeft < 0) return { label: "SLA Breached", urgent: true, breached: true };
  if (hoursLeft <= 4) return { label: `${hoursLeft}h left`, urgent: true, breached: false };
  const dist = formatDistanceToNowStrict(new Date(lead.sla_deadline), { addSuffix: false });
  return { label: dist, urgent: hoursLeft <= 12, breached: false };
}

export function LeadCard({ lead, onDragStart, onDragEnd, onEdit, onDelete, onClick, hasAIAction = false }: LeadCardProps) {
  const stars = getPriorityStars(lead);
  const salesperson = getSalesperson(lead);
  const meta = lead.metadata as Record<string, unknown> | null;
  const revenue = (meta?.odoo_revenue as number) || lead.expected_value || 0;
  const customerName = lead.customers?.company_name || lead.customers?.name || null;
  const displayTitle = lead.title.replace(/^S\d+,\s*/, "");
  const activity = getActivityStatus(lead);
  const isEmailSource = lead.source?.startsWith("Email") || lead.source === "rfq_scan";
  const winProb = lead.win_prob_score as number | null;
  const scoreConfidence = lead.score_confidence as string | null;
  const slaInfo = getSlaInfo(lead);
  const isStale = differenceInCalendarDays(new Date(), new Date(lead.updated_at)) >= 7 && lead.stage !== "won" && lead.stage !== "lost";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(lead)}
      className={cn(
        "cursor-pointer bg-background border border-border rounded-sm p-2.5 hover:shadow-sm transition-shadow relative min-h-[44px]",
        isStale && "ring-1 ring-amber-400/50"
      )}
    >
      {/* AI action indicator */}
      {hasAIAction && (
        <span
          className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 animate-pulse"
          title="AI action pending"
        />
      )}
      {/* Title + email source badge */}
      <div className="flex items-start gap-1">
        <p className="font-semibold text-[13px] leading-tight line-clamp-2 flex-1">{displayTitle}</p>
        {isEmailSource && (
          <span title="Email-sourced (ERP only)" className="shrink-0 mt-0.5">
            <Mail className="w-3 h-3 text-muted-foreground" />
          </span>
        )}
      </div>

      {/* Customer name */}
      {customerName && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{customerName}</p>
      )}

      {/* SLA countdown timer */}
      {slaInfo && (
        <div className={cn(
          "flex items-center gap-1 mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-sm w-fit",
          slaInfo.breached ? "bg-destructive/15 text-destructive" :
          slaInfo.urgent ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" :
          "bg-muted text-muted-foreground"
        )}>
          <Clock className="w-2.5 h-2.5" />
          {slaInfo.label}
        </div>
      )}

      {/* Bottom row: stars, activity dot, win prob, revenue, salesperson */}
      <div className="flex items-center justify-between mt-2">
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
              <AlignJustify className={cn("w-3 h-3", activity.color)} />
            </span>
          )}

          {/* Win probability badge with score breakdown */}
          {winProb != null && winProb > 0 && (
            <LeadScoreBreakdown leadId={lead.id} winProb={winProb} scoreConfidence={scoreConfidence}>
              <span
                title={`Win probability: ${winProb}% (${scoreConfidence || 'low'} confidence)`}
                className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0 rounded cursor-pointer",
                  winProb >= 60 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : winProb >= 35 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-muted text-muted-foreground"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <Brain className="w-2.5 h-2.5" />
                {Math.round(winProb)}%
              </span>
            </LeadScoreBreakdown>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Revenue — Odoo format */}
          {revenue > 0 && (
            <span className="text-xs font-medium text-foreground">
              $ {revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}

          {/* Salesperson badge */}
          {salesperson && (
            <div
              className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0", salesperson.color)}
              title={salesperson.name}
            >
              {salesperson.initials}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
