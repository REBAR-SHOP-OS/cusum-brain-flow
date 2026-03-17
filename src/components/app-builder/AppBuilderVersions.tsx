import { GitBranch, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AppVersion } from "@/data/appBuilderMockData";

interface Props {
  versions: AppVersion[];
}

export function AppBuilderVersions({ versions }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <GitBranch className="w-5 h-5 text-orange-400" /> Version History
      </h3>
      <div className="space-y-3">
        {versions.map((v) => (
          <div
            key={v.id}
            className={`rounded-2xl border p-4 transition-colors ${
              v.isCurrent ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">v{v.version}</span>
                {v.isCurrent && (
                  <Badge className="bg-orange-500/20 text-orange-400 border-0 text-xs">
                    <Check className="w-3 h-3 mr-1" /> Current
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(v.timestamp).toLocaleDateString()} {new Date(v.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{v.summary}</p>
            {!v.isCurrent && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs gap-1" disabled>
                  <RotateCcw className="w-3 h-3" /> Restore
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" disabled>
                  Compare
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
