import { Card, CardContent } from "@/components/ui/card";

interface BendingSchematicProps {
  dimensions: Record<string, number> | null;
  /**
   * Source unit of THIS item (from cut_plan_items.unit_system).
   * Per the Bending Schematic Unit Rule: NO global conversion. Display A–F
   * dimensions in the item's own unit. For ft-in items, A–F render as pure
   * inches (values are already stored as inches for imperial rows).
   */
  unitSystem?: string | null;
}

function unitLabelFor(unitSystem: string | null | undefined): string {
  const u = (unitSystem || "").toLowerCase();
  if (u === "mm" || u === "metric") return "mm";
  // in, ft, ft-in, ft_in, imperial → schematic always shows pure inches
  if (u === "in" || u === "ft" || u === "ft-in" || u === "ft_in" || u === "imperial") return '"';
  // Unknown / unspecified: no suffix rather than guessing
  return "";
}

export function BendingSchematic({ dimensions, unitSystem }: BendingSchematicProps) {
  const unitLabel = unitLabelFor(unitSystem);

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
          {entries.map(([key, value]) => (
            <div 
              key={key} 
              className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
            >
              <span className={`text-xl font-bold ${getColorForDimension(key)}`}>
                {key}
              </span>
              <span className="text-3xl font-black font-mono tabular-nums text-foreground">
                {value}
                {unitLabel && (
                  <span className="text-sm text-muted-foreground ml-1 font-normal">{unitLabel}</span>
                )}
              </span>
            </div>
          ))}
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
