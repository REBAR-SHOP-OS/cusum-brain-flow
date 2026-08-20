import { Eye, EyeOff } from "lucide-react";

interface AnnotationLegendProps {
  items: any[];
  hiddenTypes: Set<string>;
  onToggleType: (type: string) => void;
  colors: Record<string, string>;
}

export default function AnnotationLegend({
  items,
  hiddenTypes,
  onToggleType,
  colors,
}: AnnotationLegendProps) {
  const typeCounts: Record<string, number> = {};
  items.forEach((i) => {
    const t = (i.element_type ?? "unknown").toLowerCase();
    typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  });

  const types = Object.keys(typeCounts).sort();

  return (
    <div className="w-44 shrink-0 space-y-1.5">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Legend</h4>
      {types.map((type) => {
        const color = colors[type] ?? "#6b7280";
        const hidden = hiddenTypes.has(type);
        return (
          <button
            key={type}
            onClick={() => onToggleType(type)}
            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm transition-colors hover:bg-muted/50 ${hidden ? "opacity-40" : ""}`}
          >
            <span
              className="inline-block w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="capitalize flex-1 text-left truncate">{type}</span>
            <span className="text-xs text-muted-foreground">{typeCounts[type]}</span>
            {hidden ? (
              <EyeOff className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Eye className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        );
      })}
      {types.length === 0 && (
        <p className="text-xs text-muted-foreground">No items extracted yet.</p>
      )}
    </div>
  );
}
