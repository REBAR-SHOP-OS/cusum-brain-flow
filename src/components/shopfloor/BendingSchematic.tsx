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
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground tracking-wider uppercase font-semibold">
        Bending Schematic
      </p>
      <div className="grid gap-2">
        {entries.map(([key, value]) => (
          <Card key={key} className="bg-muted/30">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{key}</span>
                </div>
                <span className="text-xs text-muted-foreground tracking-wider uppercase">
                  Dimension {key}
                </span>
              </div>
              <span className="text-xl font-bold font-mono">
                {value}
                <span className="text-sm text-muted-foreground ml-1">mm</span>
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
