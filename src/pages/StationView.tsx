import { useParams, Navigate } from "react-router-dom";
import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { useStationData } from "@/hooks/useStationData";
import { useUserRole } from "@/hooks/useUserRole";
import { CutterStationView } from "@/components/shopfloor/CutterStationView";
import { BenderStationView } from "@/components/shopfloor/BenderStationView";
import { BarSizeGroup } from "@/components/shopfloor/BarSizeGroup";
import { StationHeader } from "@/components/shopfloor/StationHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertTriangle, LayoutGrid } from "lucide-react";
import { useState } from "react";

export default function StationView() {
  const { machineId } = useParams<{ machineId: string }>();
  const { machines, isLoading: machinesLoading } = useLiveMonitorData();
  const { groups, items, isLoading: dataLoading } = useStationData(machineId || null);
  const { isAdmin, isWorkshop } = useUserRole();
  const canWrite = isAdmin || isWorkshop;
  const [activeTab, setActiveTab] = useState("production");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);

  if (!machineId) return <Navigate to="/shopfloor/station" replace />;

  const machine = machines.find((m) => m.id === machineId);
  const isLoading = machinesLoading || dataLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Machine not found
      </div>
    );
  }

  // If user selected a specific item AND machine is cutter or bender, show focused view
  if (selectedItemId || machine.type === "bender") {
    if (machine.type === "bender") {
      return <BenderStationView machine={machine} items={items} canWrite={canWrite} />;
    }
    if (machine.type === "cutter") {
      return <CutterStationView machine={machine} items={items} canWrite={canWrite} />;
    }
  }

  // Default: show production cards grouped by bar size
  const needsFixCount = items.filter((i) => i.needs_fix).length;

  // Calculate bar size range for header
  const barCodes = groups.map((g) => g.barCode);
  const barSizeRange = barCodes.length > 1 
    ? `${barCodes[0]}-${barCodes[barCodes.length - 1]}`
    : barCodes[0] || "";

  return (
    <div className="flex flex-col h-full">
      <StationHeader
        machineName={machine.name}
        machineModel={machine.model}
        barSizeRange={barSizeRange}
        canWrite={canWrite}
        isSupervisor={isSupervisor}
        onToggleSupervisor={() => setIsSupervisor((v) => !v)}
        showBedsSuffix={true}
      />

      <div className="px-4 pt-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="production" className="gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" />
              Production
            </TabsTrigger>
            <TabsTrigger value="needs-fix" className="gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Needs Fix
              {needsFixCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1">
                  {needsFixCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="production" className="mt-0">
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="space-y-10 py-4 pr-3">
                {groups.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No items queued to this machine yet
                  </div>
                ) : (
                  groups.map((group) => (
                    <BarSizeGroup
                      key={group.barCode}
                      group={group}
                      canWrite={canWrite}
                      isSupervisor={isSupervisor}
                      onCardClick={(itemId) => {
                        setSelectedItemId(itemId);
                      }}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="needs-fix" className="mt-0">
            <ScrollArea className="h-[calc(100vh-180px)]">
              <div className="space-y-3 pb-6 pr-3 pt-4">
                {items.filter((i) => i.needs_fix).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No items flagged for review
                  </div>
                ) : (
                  items
                    .filter((i) => i.needs_fix)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-destructive/30 bg-destructive/5"
                      >
                        <p className="font-semibold text-sm">
                          {item.mark_number || "Unnamed"} — {item.bar_code}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.drawing_ref || "No drawing ref"} • {item.cut_length_mm}mm
                        </p>
                      </div>
                    ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
