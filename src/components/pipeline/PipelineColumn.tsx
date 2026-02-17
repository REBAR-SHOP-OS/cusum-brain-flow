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
}

const ACTIVITY_COLORS: Record<ActivityStatus, string> = {
  planned: "#21b632",
  today: "#f0ad4e",
  overdue: "#d9534f",
  none: "#d1d5db",
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
        "w-[280px] flex-shrink-0 rounded-lg transition-colors flex flex-col h-full",
        isDragOver ? "bg-primary/10 ring-2 ring-primary/50" : "bg-secondary/30"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm truncate flex-1">{stage.label}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {totalValue > 0 && (
              <span className="text-xs font-medium text-muted-foreground">
                $ {totalValue.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[20px] justify-center">
              {activityFilter ? displayedLeads.length : leads.length}
            </Badge>
          </div>
        </div>
        {/* Activity status distribution bar — clickable segments */}
        <div className="mt-1.5 h-2 w-full rounded-full overflow-hidden flex" style={{ backgroundColor: '#e5e7eb' }}>
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
      <div className="px-2 pb-2 space-y-2 min-h-[120px] flex-1 overflow-y-auto">
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
            />
          ))
        )}
      </div>
    </div>
  );
}
