import React from "react";
import { VentureCard } from "./VentureCard";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { Venture } from "@/types/venture";

interface Props {
  ventures: Venture[];
  phases: { key: string; label: string; emoji: string }[];
  isLoading: boolean;
  onSelect: (v: Venture) => void;
  onPhaseChange: (id: string, phase: string) => void;
}

export const EmpireBoard: React.FC<Props> = ({ ventures, phases, isLoading, onSelect, onPhaseChange }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {phases.map((p) => (
          <div key={p.key} className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 min-w-[1100px] pb-4">
        {phases.map((phase) => {
          const items = ventures.filter((v) => v.phase === phase.key);
          return (
            <div
              key={phase.key}
              className="flex-1 min-w-[200px] rounded-xl border border-border bg-card/50 p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("ventureId");
                if (id) onPhaseChange(id, phase.key);
              }}
            >
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="text-lg">{phase.emoji}</span>
                <h3 className="text-sm font-semibold text-foreground">{phase.label}</h3>
                <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {items.map((v) => (
                  <VentureCard key={v.id} venture={v} onClick={() => onSelect(v)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};
