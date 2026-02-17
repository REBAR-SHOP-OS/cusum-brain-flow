import { useState, useRef, useCallback, useEffect } from "react";
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
  onLeadClick: (lead: LeadWithCustomer) => void;
}

const EDGE_ZONE = 60;
const SCROLL_SPEED = 8;

export function PipelineBoard({
  stages,
  leadsByStage,
  isLoading,
  onStageChange,
  onEdit,
  onDelete,
  onLeadClick,
}: PipelineBoardProps) {
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollInterval = useRef<number | null>(null);

  const clearAutoScroll = useCallback(() => {
    if (scrollInterval.current !== null) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  }, []);

  useEffect(() => clearAutoScroll, [clearAutoScroll]);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLead(leadId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", leadId);
  };

  const handleBoardDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;

    clearAutoScroll();
    if (x < EDGE_ZONE) {
      scrollInterval.current = window.setInterval(() => {
        container.scrollLeft -= SCROLL_SPEED;
      }, 16);
    } else if (x > rect.width - EDGE_ZONE) {
      scrollInterval.current = window.setInterval(() => {
        container.scrollLeft += SCROLL_SPEED;
      }, 16);
    }
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
    const leadId = draggedLead || e.dataTransfer.getData("text/plain");
    if (leadId) {
      onStageChange(leadId, stageId);
    }
    setDraggedLead(null);
    setDragOverStage(null);
    clearAutoScroll();
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverStage(null);
    clearAutoScroll();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading pipeline...</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-x-auto overflow-y-hidden"
      onDragOver={handleBoardDragOver}
      onDragEnd={handleDragEnd}
      onDrop={() => clearAutoScroll()}
    >
      <div className="flex gap-4 p-4 sm:p-6 min-w-max h-full">
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
            onLeadClick={onLeadClick}
          />
        ))}
      </div>
    </div>
  );
}
