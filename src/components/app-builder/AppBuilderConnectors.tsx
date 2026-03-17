import { Plug, ChevronRight, Circle } from "lucide-react";
import { CONNECTORS, type ConnectorDef } from "@/data/appBuilderMockData";
import { cn } from "@/lib/utils";

interface Props {
  onDiagnose: (prompt: string) => void;
}

function StatusDot({ status }: { status: ConnectorDef["status"] }) {
  return (
    <Circle
      className={cn(
        "w-2.5 h-2.5 fill-current",
        status === "connected" && "text-emerald-400",
        status === "disconnected" && "text-muted-foreground/40",
        status === "error" && "text-red-400"
      )}
    />
  );
}

export function AppBuilderConnectors({ onDiagnose }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Plug className="w-5 h-5 text-orange-400" />
        <h3 className="text-lg font-semibold text-foreground">Connectors</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Linked modules and external services. Click to run a diagnostic via the Architect agent.
      </p>

      <div className="grid gap-3">
        {CONNECTORS.map((c) => (
          <button
            key={c.id}
            onClick={() => onDiagnose(c.diagnosticPrompt)}
            className="w-full flex items-center gap-4 rounded-2xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors text-left group"
          >
            <span className="text-2xl">{c.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-foreground">{c.name}</span>
                <StatusDot status={c.status} />
                <span className="text-xs text-muted-foreground capitalize">{c.status}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
          </button>
        ))}
      </div>

      <button
        disabled
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:border-foreground/20 transition-colors"
      >
        <Plug className="w-4 h-4" />
        Add Connector
      </button>
    </div>
  );
}
