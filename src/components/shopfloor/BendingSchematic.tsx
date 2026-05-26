import { Card, CardContent } from "@/components/ui/card";
import { useUnitSystem, lengthUnit } from "@/lib/unitSystem";
import { isImperial } from "@/lib/cutMath";

interface BendingSchematicProps {
  dimensions: Record<string, number> | null;
  sourceDimensions?: Record<string, string> | null;
  unitSystem?: string | null;
}

export function BendingSchematic({ dimensions, sourceDimensions, unitSystem: itemUnitSystem }: BendingSchematicProps) {
  const workspaceUnitSystem = useUnitSystem();
  const unitLabel = itemUnitSystem != null
    ? (isImperial(itemUnitSystem) ? '"' : 'mm')
    : lengthUnit(workspaceUnitSystem);


  if (!dimensions || Object.keys(dimensions).length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center text-muted-foreground text-sm">
        No dimension data available
      </div>
    );
  }

  const entries = Object.entries(dimensions).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold tracking-[0.15em] uppercase text-muted-foreground">
          ⬡ Bending Schematic
        </span>
      </div>
      
      <Card className="bg-card border border-border">
        <CardContent className="p-4 space-y-3">
          {entries.map(([key, value]) => {
            const sourceValue = sourceDimensions?.[key]?.trim();
            const hasSourceUnit = sourceValue ? /['"a-zA-Z]/.test(sourceValue) : false;

            return (
              <div 
                key={key} 
                className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
              >
                <span className={`text-xl font-bold ${getColorForDimension(key)}`}>
                  {key}
                </span>
                <span className="text-3xl font-black font-mono text-foreground">
                  {sourceValue || value}
                  {!hasSourceUnit && (
                    <span className="text-sm text-muted-foreground ml-1 font-normal">{unitLabel}</span>
                  )}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function getColorForDimension(key: string): string {
  const colors: Record<string, string> = {
    A: "text-primary",
    B: "text-primary",
    C: "text-red-500",
    D: "text-muted-foreground",
    E: "text-primary",
    F: "text-primary",
    G: "text-primary",
    H: "text-muted-foreground",
    J: "text-muted-foreground",
    K: "text-muted-foreground",
    O: "text-primary",
    R: "text-primary",
  };
  return colors[key.toUpperCase()] || "text-muted-foreground";
}
