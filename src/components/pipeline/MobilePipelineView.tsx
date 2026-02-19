import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { SwipeableLeadCard } from "./SwipeableLeadCard";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface Stage {
  id: string;
  label: string;
  color: string;
}

interface Props {
  stages: Stage[];
  leadsByStage: Record<string, LeadWithCustomer[]>;
  isLoading: boolean;
  onStageChange: (leadId: string, newStage: string) => void;
  onLeadClick: (lead: LeadWithCustomer) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
}

export function MobilePipelineView({ stages, leadsByStage, isLoading, onStageChange, onLeadClick, onEdit, onDelete }: Props) {
  const [selectedStage, setSelectedStage] = useState(stages[0]?.id ?? "");

  const currentStageIndex = stages.findIndex(s => s.id === selectedStage);
  const nextStage = currentStageIndex < stages.length - 1 ? stages[currentStageIndex + 1] : null;
  const prevStage = currentStageIndex > 0 ? stages[currentStageIndex - 1] : null;

  const stageLeads = leadsByStage[selectedStage] ?? [];
  const stageInfo = stages.find(s => s.id === selectedStage);

  const handleSwipeRight = (leadId: string) => {
    if (nextStage) onStageChange(leadId, nextStage.id);
  };

  const handleSwipeLeft = (leadId: string) => {
    if (prevStage) onStageChange(leadId, prevStage.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stage selector */}
      <div className="px-3 py-2 border-b border-border bg-background shrink-0">
        <Select value={selectedStage} onValueChange={setSelectedStage}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stages.map(s => (
              <SelectItem key={s.id} value={s.id}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.color}`} />
                  {s.label}
                  <span className="text-muted-foreground ml-1">({leadsByStage[s.id]?.length ?? 0})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
          <span>{prevStage ? `← ${prevStage.label}` : ""}</span>
          <span className="font-medium text-foreground">{stageLeads.length} leads</span>
          <span>{nextStage ? `${nextStage.label} →` : ""}</span>
        </div>
      </div>

      {/* Lead list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {stageLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">No leads in {stageInfo?.label}</p>
          </div>
        ) : (
          stageLeads.map(lead => (
            <SwipeableLeadCard
              key={lead.id}
              lead={lead}
              onSwipeRight={() => handleSwipeRight(lead.id)}
              onSwipeLeft={() => handleSwipeLeft(lead.id)}
              onClick={() => onLeadClick(lead)}
              nextStageLabel={nextStage?.label}
              prevStageLabel={prevStage?.label}
            />
          ))
        )}
      </div>
    </div>
  );
}
