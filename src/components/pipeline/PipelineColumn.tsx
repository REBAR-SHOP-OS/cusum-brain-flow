import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LeadCard } from "./LeadCard";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

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
  const totalValue = leads.reduce((sum, lead) => {
    const meta = lead.metadata as Record<string, unknown> | null;
    return sum + ((meta?.odoo_revenue as number) || lead.expected_value || 0);
  }, 0);

  // Priority distribution for Odoo-style bar
  const total = leads.length;
  const high = leads.filter((l) => getPriorityStars(l) === 3).length;
  const medium = leads.filter((l) => getPriorityStars(l) === 2).length;
  const low = total - high - medium;

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
      {/* Column Header — Odoo style: stage name, full currency, count */}
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
              {leads.length}
            </Badge>
          </div>
        </div>
        {/* Priority distribution bar */}
        <div className="mt-1.5 h-1 w-full rounded-full overflow-hidden flex" style={{ backgroundColor: 'hsl(var(--muted))' }}>
          {total > 0 ? (
            <>
              {high > 0 && (
                <div className="h-full" style={{ width: `${(high / total) * 100}%`, backgroundColor: '#21b632' }} />
              )}
              {medium > 0 && (
                <div className="h-full" style={{ width: `${(medium / total) * 100}%`, backgroundColor: '#f0ad4e' }} />
              )}
              {low > 0 && (
                <div className="h-full" style={{ width: `${(low / total) * 100}%`, backgroundColor: '#d9534f' }} />
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Cards */}
      <div className="px-2 pb-2 space-y-2 min-h-[120px] flex-1 overflow-y-auto">
        {leads.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 opacity-50">
            Drop leads here
          </p>
        ) : (
          leads.map((lead) => (
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
