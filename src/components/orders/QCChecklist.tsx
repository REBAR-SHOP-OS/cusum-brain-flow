import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface QCGate {
  label: string;
  checked: boolean;
  timestamp: string | null;
  field: string;
}

interface Props {
  gates: QCGate[];
  onToggle: (field: string, checked: boolean) => void;
  disabled?: boolean;
}

export function QCChecklist({ gates, onToggle, disabled }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        QC Checklist
      </p>
      <div className="space-y-1.5">
        {gates.map((gate) => (
          <div
            key={gate.field}
            className="flex items-center gap-3 p-2 rounded-lg border border-border/50 bg-muted/10"
          >
            <Checkbox
              checked={gate.checked}
              onCheckedChange={(v) => onToggle(gate.field, !!v)}
              disabled={disabled}
            />
            <span className="text-sm flex-1">{gate.label}</span>
            {gate.timestamp && (
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200">
                {format(new Date(gate.timestamp), "MMM d, h:mm a")}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
