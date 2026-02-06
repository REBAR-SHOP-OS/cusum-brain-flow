import { useRef, useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PipelineColumn } from "./PipelineColumn";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface Stage {
  id: string;
  label: string;
  color: string;
}

interface PipelineBoardProps {
  stages: Stage[];
  leadsByStage: Record<string, LeadWithCustomer[]>;
  isLoading: boolean;
  onStageChange: (leadId: string, newStage: string) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
}

export function PipelineBoard({
  stages,
  leadsByStage,
  isLoading,
  onStageChange,
  onEdit,
  onDelete,
}: PipelineBoardProps) {
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLead(leadId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverStage(stageId);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (draggedLead) {
      onStageChange(draggedLead, stageId);
    }
    setDraggedLead(null);
    setDragOverStage(null);
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverStage(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading pipeline...</div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex gap-4 p-6 min-w-max">
        {stages.map((stage) => (
          <PipelineColumn
            key={stage.id}
            stage={stage}
            leads={leadsByStage[stage.id] || []}
            isDragOver={dragOverStage === stage.id}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.id)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
