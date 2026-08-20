import { useIntake } from "@/contexts/IntakeContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";

const ALL_VALUE = "__all__";

/**
 * IntakeSelector — top-bar dropdown that scopes every shop-floor station to
 * one uploaded barlist/manifest. "All intakes" reverts to the legacy
 * company-wide view (useful for admins / debugging).
 */
export function IntakeSelector({ className = "" }: { className?: string }) {
  const { intakeId, setIntakeId, intakes, activeIntake, loading } = useIntake();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Layers className="w-4 h-4 text-primary shrink-0" />
      <Select
        value={intakeId ?? ALL_VALUE}
        onValueChange={(v) => setIntakeId(v === ALL_VALUE ? null : v)}
        disabled={loading}
      >
        <SelectTrigger className="h-8 min-w-[220px] max-w-[360px] text-xs">
          <SelectValue placeholder="All intakes" />
        </SelectTrigger>
        <SelectContent className="max-h-[420px]">
          <SelectItem value={ALL_VALUE}>
            <span className="font-semibold">All intakes</span>
          </SelectItem>
          {intakes.map((i) => (
            <SelectItem key={i.id} value={i.id}>
              <div className="flex flex-col">
                <span className="font-medium truncate max-w-[320px]">{i.label}</span>
                <span className="text-[10px] text-muted-foreground truncate max-w-[320px]">
                  {[i.customer_name, i.project_name].filter(Boolean).join(" — ")}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {activeIntake && (
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          Scoped
        </Badge>
      )}
    </div>
  );
}
