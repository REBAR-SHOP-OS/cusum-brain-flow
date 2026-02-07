import { Card, CardContent } from "@/components/ui/card";

interface BendingSchematicProps {
  dimensions: Record<string, number> | null;
}

export function BendingSchematic({ dimensions }: BendingSchematicProps) {
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
              <span className="text-3xl font-black font-mono text-foreground">
                {value}
                <span className="text-sm text-muted-foreground ml-1 font-normal">mm</span>
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
