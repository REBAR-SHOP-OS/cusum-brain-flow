import { Badge } from "@/components/ui/badge";
import { ProductionCard } from "./ProductionCard";
import { Link2 } from "lucide-react";
import type { BarSizeGroup as BarSizeGroupType } from "@/hooks/useStationData";

interface BarSizeGroupProps {
  group: BarSizeGroupType;
  canWrite: boolean;
  isSupervisor?: boolean;
  onCardClick?: (itemId: string) => void;
}

export function BarSizeGroup({ group, canWrite, isSupervisor = false, onCardClick }: BarSizeGroupProps) {
  const totalItems = group.bendItems.length + group.straightItems.length;

  return (
    <div className="space-y-5">
      {/* Bar size header — matching reference */}
      <div className="flex items-center gap-3 py-2">
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-2xl font-black text-foreground">{group.barCode}</h3>
          <p className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
            Size Reservoir Protocol
          </p>
        </div>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Two-column layout: Cut & Bend | Straight Cut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* CUT & BEND path */}
        {group.bendItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase text-orange-500">
                🔥 Path: Cut & Bend
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase text-blue-500">
                ✂ Path: Straight Cut
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
