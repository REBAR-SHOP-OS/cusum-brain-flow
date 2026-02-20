import { useParams, Navigate } from "react-router-dom";
import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { useStationData } from "@/hooks/useStationData";
import { useUserRole } from "@/hooks/useUserRole";
import { CutterStationView } from "@/components/shopfloor/CutterStationView";
import { BenderStationView } from "@/components/shopfloor/BenderStationView";
import { BarSizeGroup } from "@/components/shopfloor/BarSizeGroup";
import { ProductionCard } from "@/components/shopfloor/ProductionCard";
import { StationHeader } from "@/components/shopfloor/StationHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertTriangle, LayoutGrid } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";

export default function StationView() {
  const { machineId } = useParams<{ machineId: string }>();
  const { machines, isLoading: machinesLoading } = useLiveMonitorData();
  const machine = machines.find((m) => m.id === machineId);
  const { groups, items, isLoading: dataLoading, error } = useStationData(machineId || null, machine?.type);
  const { isAdmin, isWorkshop } = useUserRole();
  const canWrite = isAdmin || isWorkshop;
  const [activeTab, setActiveTab] = useState("production");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Distinct project names present in loaded items
  const projectNames = useMemo(
    () => [...new Set(items.map((i) => i.project_name).filter(Boolean))] as string[],
    [items]
  );

  // Auto-reset if selected project disappears (e.g. phase transition)
  useEffect(() => {
    if (selectedProject && !projectNames.includes(selectedProject)) {
      setSelectedProject(null);
    }
  }, [projectNames, selectedProject]);

  // Filtered views
  const filteredItems = selectedProject
    ? items.filter((i) => i.project_name === selectedProject)
    : items;

  const filteredGroups = selectedProject
    ? groups
        .map((g) => ({
          ...g,
          bendItems: g.bendItems.filter((i) => i.project_name === selectedProject),
          straightItems: g.straightItems.filter((i) => i.project_name === selectedProject),
        }))
        .filter((g) => g.bendItems.length > 0 || g.straightItems.length > 0)
    : groups;

  if (!machineId) return <Navigate to="/shopfloor/station" replace />;

  const isLoading = machinesLoading || dataLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive gap-3 py-20">
        <AlertTriangle className="w-12 h-12 opacity-60" />
        <p className="text-sm">Failed to load station data</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
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

  // If user selected a specific item, show focused view for that machine type
  if (selectedItemId) {
    if (machine.type === "bender") {
      const itemIndex = items.findIndex((i) => i.id === selectedItemId);
      return (
        <BenderStationView
          machine={machine}
          items={items}
          canWrite={canWrite}
          initialIndex={itemIndex >= 0 ? itemIndex : 0}
          onBack={() => setSelectedItemId(null)}
        />
      );
    }
    if (machine.type === "cutter") {
      const itemIndex = items.findIndex((i) => i.id === selectedItemId);
      return (
        <CutterStationView
          machine={machine}
          items={items}
          canWrite={canWrite}
          initialIndex={itemIndex >= 0 ? itemIndex : 0}
          onBack={() => setSelectedItemId(null)}
        />
      );
    }
  }

  // Default: show production cards grouped by bar size (cutters) or flat grid (benders)
  const needsFixCount = items.filter((i) => i.needs_fix).length;
  const isBender = machine.type === "bender";

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
        barSizeRange={isBender ? undefined : barSizeRange}
        canWrite={canWrite}
        isSupervisor={isSupervisor}
        onToggleSupervisor={() => setIsSupervisor((v) => !v)}
        showBedsSuffix={true}
      />

      <div className="px-4 pt-3">
        {/* Project filter pills — only shown when multiple projects present */}
        {projectNames.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none">
            <button
              onClick={() => setSelectedProject(null)}
              className={cn(
                "shrink-0 text-[10px] font-bold tracking-wider px-3 py-1.5 rounded-full border transition-colors",
                !selectedProject
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              )}
            >
              ALL ({items.length})
            </button>
            {projectNames.map((name) => (
              <button
                key={name}
                onClick={() => setSelectedProject(name)}
                className={cn(
                  "shrink-0 text-[10px] font-bold tracking-wider px-3 py-1.5 rounded-full border transition-colors max-w-[180px] truncate",
                  selectedProject === name
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                )}
              >
                {name} ({items.filter((i) => i.project_name === name).length})
              </button>
            ))}
          </div>
        )}

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
                {isBender ? (
                  filteredItems.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      No items queued to this bender yet
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredItems.map((item) => (
                        <ProductionCard
                          key={item.id}
                          item={item}
                          canWrite={canWrite}
                          isSupervisor={isSupervisor}
                          machineId={machineId}
                          machineType={machine?.type}
                          onClick={() => setSelectedItemId(item.id)}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  filteredGroups.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      No items queued to this machine yet
                    </div>
                  ) : (
                    filteredGroups.map((group) => (
                      <BarSizeGroup
                        key={group.barCode}
                        group={group}
                        canWrite={canWrite}
                        isSupervisor={isSupervisor}
                        machineId={machineId}
                        machineType={machine?.type}
                        onCardClick={(itemId) => {
                          setSelectedItemId(itemId);
                        }}
                      />
                    ))
                  )
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

StationView.displayName = "StationView";
