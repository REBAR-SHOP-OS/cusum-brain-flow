import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { MachineSelector } from "@/components/shopfloor/MachineSelector";
import { ActiveProductionHub } from "@/components/shopfloor/ActiveProductionHub";
import { Badge } from "@/components/ui/badge";
import { Cloud, Radio, Loader2 } from "lucide-react";

export default function StationDashboard() {
  const { machines, isLoading } = useLiveMonitorData();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-wide uppercase">
            Station Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select a fabrication unit to begin production
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Cloud className="w-3 h-3 text-primary" />
            Cloud Synced
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Radio className="w-3 h-3 text-success animate-pulse" />
            Real-Time Active
          </Badge>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ActiveProductionHub machines={machines} />
            <MachineSelector machines={machines} />
          </>
        )}
      </div>
    </div>
  );
}
