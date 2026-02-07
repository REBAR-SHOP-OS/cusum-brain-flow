import { ProductionCard } from "./ProductionCard";
import { Link2, Flame, Scissors } from "lucide-react";
import type { BarSizeGroup as BarSizeGroupType } from "@/hooks/useStationData";

interface BarSizeGroupProps {
  group: BarSizeGroupType;
  canWrite: boolean;
  isSupervisor?: boolean;
  onCardClick?: (itemId: string) => void;
}

export function BarSizeGroup({ group, canWrite, isSupervisor = false, onCardClick }: BarSizeGroupProps) {
  return (
    <div className="space-y-5">
      {/* Bar size header — blue circle icon + title + divider line */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shrink-0">
          <Link2 className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-3xl font-black text-foreground tracking-tight">{group.barCode}</h3>
          <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground font-medium">
            Size Reservoir Protocol
          </p>
        </div>
        <div className="flex-1 h-px bg-border ml-2" />
      </div>

      {/* Two-column layout: Cut & Bend | Straight Cut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-6">
        {/* CUT & BEND path */}
        {group.bendItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold tracking-[0.15em] uppercase text-orange-500">
                Path: Cut & Bend
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {group.bendItems.map((item) => (
                <ProductionCard
                  key={item.id}
                  item={item}
                  canWrite={canWrite}
                  isSupervisor={isSupervisor}
                  onClick={() => onCardClick?.(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* STRAIGHT CUT path */}
        {group.straightItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold tracking-[0.15em] uppercase text-blue-500">
                Path: Straight Cut
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {group.straightItems.map((item) => (
                <ProductionCard
                  key={item.id}
                  item={item}
                  canWrite={canWrite}
                  isSupervisor={isSupervisor}
                  onClick={() => onCardClick?.(item.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
