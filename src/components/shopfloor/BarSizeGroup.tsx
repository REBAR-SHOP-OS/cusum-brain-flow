import { Badge } from "@/components/ui/badge";
import { ProductionCard } from "./ProductionCard";
import type { BarSizeGroup as BarSizeGroupType } from "@/hooks/useStationData";

interface BarSizeGroupProps {
  group: BarSizeGroupType;
  canWrite: boolean;
  onCardClick?: (itemId: string) => void;
}

export function BarSizeGroup({ group, canWrite, onCardClick }: BarSizeGroupProps) {
  const totalItems = group.bendItems.length + group.straightItems.length;

  return (
    <div className="space-y-4">
      {/* Bar size header */}
      <div className="flex items-center gap-3 py-2">
        <Badge className="bg-muted text-foreground border-border font-mono text-sm px-3 py-1">
          {group.barCode}
        </Badge>
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">
          {totalItems} items • SIZE RESERVOIR PROTOCOL
        </span>
      </div>

      {/* Two columns: Cut & Bend | Straight Cut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CUT & BEND path */}
        {group.bendItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-xs font-semibold tracking-wider uppercase text-warning">
                Path: Cut & Bend
              </span>
              <Badge variant="outline" className="text-[10px]">
                {group.bendItems.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.bendItems.map((item) => (
                <ProductionCard
                  key={item.id}
                  item={item}
                  canWrite={canWrite}
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
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-semibold tracking-wider uppercase text-primary">
                Path: Straight Cut
              </span>
              <Badge variant="outline" className="text-[10px]">
                {group.straightItems.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.straightItems.map((item) => (
                <ProductionCard
                  key={item.id}
                  item={item}
                  canWrite={canWrite}
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
