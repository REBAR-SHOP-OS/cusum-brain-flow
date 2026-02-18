import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LeadCard } from "./LeadCard";
import { differenceInCalendarDays } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

type ActivityStatus = "overdue" | "today" | "planned" | "none";

function getActivityStatus(lead: Lead): ActivityStatus {
  if (lead.stage === "won" || lead.stage === "lost") return "none";
  if (!lead.expected_close_date) return "none";
  const diff = differenceInCalendarDays(new Date(lead.expected_close_date), new Date());
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  return "planned";
}

interface Stage {
  id: string;
  label: string;
  color: string;
}

interface PipelineColumnProps {
  stage: Stage;
  leads: LeadWithCustomer[];
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onDragEnd: () => void;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onLeadClick: (lead: LeadWithCustomer) => void;
  aiMode?: boolean;
  aiActionLeadIds?: Set<string>;
}

const ACTIVITY_COLORS: Record<ActivityStatus, string> = {
  planned: "#21b632",
  today: "#f0ad4e",
  overdue: "#d9534f",
  none: "#a0aec0",
};

const ACTIVITY_ORDER: ActivityStatus[] = ["planned", "today", "overdue", "none"];

export function PipelineColumn({
  stage,
  leads,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
  onLeadClick,
  aiMode = false,
  aiActionLeadIds = new Set(),
}: PipelineColumnProps) {
  const [activityFilter, setActivityFilter] = useState<ActivityStatus | null>(null);

  const totalValue = leads.reduce((sum, lead) => {
    const meta = lead.metadata as Record<string, unknown> | null;
    return sum + ((meta?.odoo_revenue as number) || lead.expected_value || 0);
  }, 0);

  const total = leads.length;

  // Count leads per activity status
  const counts: Record<ActivityStatus, number> = { planned: 0, today: 0, overdue: 0, none: 0 };
  leads.forEach((l) => { counts[getActivityStatus(l)]++; });

  // Filter displayed leads when a segment is clicked
  const displayedLeads = activityFilter
    ? leads.filter((l) => getActivityStatus(l) === activityFilter)
    : leads;

  const handleSegmentClick = (status: ActivityStatus) => {
    setActivityFilter((prev) => (prev === status ? null : status));
  };

  return (
    <div
      className={cn(
        "w-[272px] flex-shrink-0 transition-colors flex flex-col h-full border-r border-border last:border-r-0",
        isDragOver ? "bg-primary/5" : "bg-muted/20"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column Header — Odoo style: flat, compact */}
      <div className="px-2 pt-2 pb-1.5 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[13px] truncate flex-1 text-foreground">{stage.label}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {totalValue > 0 && (
              <span className="text-[11px] font-medium text-muted-foreground">
                $ {totalValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[20px] justify-center rounded-sm">
              {activityFilter ? displayedLeads.length : leads.length}
            </Badge>
          </div>
        </div>
        {/* Activity status distribution bar — clickable segments */}
        <div className="mt-1 h-1.5 w-full rounded-sm overflow-hidden flex" style={{ backgroundColor: '#e2e8f0' }}>
          {total > 0 && ACTIVITY_ORDER.map((status) => {
            const count = counts[status];
            if (count === 0) return null;
            return (
              <button
                key={status}
                type="button"
                className={cn(
                  "h-full transition-opacity",
                  activityFilter && activityFilter !== status ? "opacity-30" : "opacity-100"
                )}
                style={{
                  width: `${(count / total) * 100}%`,
                  backgroundColor: ACTIVITY_COLORS[status],
                }}
                onClick={() => handleSegmentClick(status)}
                title={`${status}: ${count} lead${count !== 1 ? "s" : ""}`}
              />
            );
          })}
        </div>
      </div>

      {/* Cards */}
      <div className="px-1.5 py-1.5 space-y-1 min-h-[120px] flex-1 overflow-y-auto">
        {displayedLeads.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 opacity-50">
            {activityFilter ? "No leads with this activity" : "Drop leads here"}
          </p>
        ) : (
          displayedLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onEdit={onEdit}
              onDelete={onDelete}
              onClick={onLeadClick}
              hasAIAction={aiMode && aiActionLeadIds.has(lead.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
