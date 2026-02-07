import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { MachineSelector } from "@/components/shopfloor/MachineSelector";
import { ActiveProductionHub } from "@/components/shopfloor/ActiveProductionHub";
import { Badge } from "@/components/ui/badge";
import { Cloud, Radio, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import brandLogo from "@/assets/brand-logo.png";

export default function StationDashboard() {
  const { machines, isLoading } = useLiveMonitorData();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <img src={brandLogo} alt="Logo" className="w-8 h-8 rounded-lg" />
          <div>
            <h1 className="text-sm font-bold tracking-wide uppercase">
              Station Dashboard
            </h1>
            <p className="text-[9px] tracking-[0.15em] uppercase text-primary">
              ◉ Cloud Synced / Real-Time Active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-xs hidden sm:flex">
            <Cloud className="w-3 h-3 text-primary" />
            Cloud Synced
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-xs hidden sm:flex">
            <Radio className="w-3 h-3 text-success animate-pulse" />
            Real-Time Active
          </Badge>
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-10">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ActiveProductionHub machines={machines} />

            {/* Live Queue placeholder */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">0</div>
                <h2 className="text-lg font-black italic tracking-wide uppercase text-foreground">
                  Live Queue
                </h2>
              </div>
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Drag & drop orders to reorder
                </p>
              </div>
            </div>

            <MachineSelector machines={machines} />
          </>
        )}
      </div>
    </div>
  );
}
