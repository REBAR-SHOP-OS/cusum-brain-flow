import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LeadCard } from "./LeadCard";
import { Plus } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

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

  // Revenue bar: fraction of max possible (cap at $500k for display)
  const barFraction = Math.min(totalValue / 500_000, 1);

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
      {/* Column Header — Odoo style */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className="font-semibold text-sm truncate flex-1">{stage.label}</h3>
          <div className="flex items-center gap-1 shrink-0">
            {totalValue > 0 && (
              <span className="text-xs font-medium text-muted-foreground">
                {totalValue >= 1_000_000
                  ? `${(totalValue / 1_000_000).toFixed(1)}M`
                  : totalValue >= 1000
                    ? `${(totalValue / 1000).toFixed(0)}K`
                    : totalValue.toLocaleString()
                }
              </span>
            )}
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[20px] justify-center">
              {leads.length}
            </Badge>
          </div>
        </div>

        {/* Revenue progress bar */}
        <div className="h-1 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", stage.color)}
            style={{ width: `${Math.max(barFraction * 100, leads.length > 0 ? 5 : 0)}%` }}
          />
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
