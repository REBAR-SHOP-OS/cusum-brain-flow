import { useState, useRef, useCallback, useEffect } from "react";
import { PipelineColumn } from "./PipelineColumn";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
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
  canReorder?: boolean;
  onReorder?: (newOrder: string[]) => void;
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
  canReorder = false,
  onReorder,
}: PipelineBoardProps) {
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollInterval = useRef<number | null>(null);

  // Column reorder state (separate from card DnD)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [columnDragOver, setColumnDragOver] = useState<string | null>(null);
  const [localStages, setLocalStages] = useState(stages);

  useEffect(() => {
    setLocalStages(stages);
  }, [stages]);

  const clearAutoScroll = useCallback(() => {
    if (scrollInterval.current !== null) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  }, []);

  useEffect(() => clearAutoScroll, [clearAutoScroll]);

  // ---- Card drag handlers ----
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLead(leadId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", leadId);
    e.dataTransfer.setData("application/card-drag", "true");
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
    // Only handle card drops, not column drops
    if (e.dataTransfer.types.includes("application/column-drag")) return;
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

  // ---- Column reorder handlers (admin-only) ----
  const handleColumnDragStart = (e: React.DragEvent, stageId: string) => {
    e.stopPropagation();
    setDraggedColumn(stageId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/column-drag", stageId);
  };

  const handleColumnDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedColumn || draggedColumn === stageId) return;
    setColumnDragOver(stageId);

    // Reorder locally for live preview
    setLocalStages((prev) => {
      const fromIdx = prev.findIndex((s) => s.id === draggedColumn);
      const toIdx = prev.findIndex((s) => s.id === stageId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const handleColumnDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedColumn && onReorder) {
      onReorder(localStages.map((s) => s.id));
    }
    setDraggedColumn(null);
    setColumnDragOver(null);
  };

  const handleColumnDragEnd = () => {
    setDraggedColumn(null);
    setColumnDragOver(null);
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
        {localStages.map((stage) => (
          <div
            key={stage.id}
            className={cn(
              "relative",
              draggedColumn === stage.id && "opacity-50"
            )}
            onDragOver={canReorder ? (e) => handleColumnDragOver(e, stage.id) : undefined}
            onDrop={canReorder ? handleColumnDrop : undefined}
          >
            {/* Draggable column header grip (admin only) */}
            {canReorder && (
              <div
                draggable
                onDragStart={(e) => handleColumnDragStart(e, stage.id)}
                onDragEnd={handleColumnDragEnd}
                className="absolute -top-0 left-1/2 -translate-x-1/2 z-10 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-accent/60 transition-colors"
                title="Drag to reorder column"
              >
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            )}
            <PipelineColumn
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
          </div>
        ))}
      </div>
    </div>
  );
}
