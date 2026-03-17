import { Database, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { EntityPlan } from "@/data/appBuilderMockData";

interface Props {
  entities: EntityPlan[];
}

export function AppBuilderDataModel({ entities }: Props) {
  const typeColors: Record<string, string> = {
    UUID: "text-purple-400",
    text: "text-blue-400",
    decimal: "text-emerald-400",
    enum: "text-amber-400",
    date: "text-cyan-400",
    timestamp: "text-cyan-400",
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Database className="w-5 h-5 text-orange-400" /> Data Model ({entities.length} entities)
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {entities.map((entity) => (
          <div key={entity.name} className="rounded-2xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              {entity.name}
            </h4>

            <div className="space-y-1 mb-3">
              {entity.fields.map((f) => (
                <div key={f.name} className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-foreground w-24 truncate">{f.name}</span>
                  <span className={typeColors[f.type.startsWith("FK") ? "UUID" : f.type] ?? "text-muted-foreground"}>{f.type}</span>
                  {f.note && <span className="text-muted-foreground italic ml-auto truncate max-w-[120px]">{f.note}</span>}
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-2">
              <span className="text-xs text-muted-foreground block mb-1">Relationships</span>
              {entity.relationships.map((r) => (
                <div key={r} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ArrowRight className="w-3 h-3 text-orange-400" /> {r}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
