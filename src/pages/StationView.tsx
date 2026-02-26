import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { useStationData } from "@/hooks/useStationData";
import { useUserRole } from "@/hooks/useUserRole";
import { useTabletPin } from "@/hooks/useTabletPin";
import { CutterStationView } from "@/components/shopfloor/CutterStationView";
import { BenderStationView } from "@/components/shopfloor/BenderStationView";
import { BarSizeGroup } from "@/components/shopfloor/BarSizeGroup";
import { ProductionCard } from "@/components/shopfloor/ProductionCard";
import { StationHeader } from "@/components/shopfloor/StationHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertTriangle, LayoutGrid, Unlock, Lock, FolderOpen, ArrowLeft } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";

export default function StationView() {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();
  const { machines, isLoading: machinesLoading } = useLiveMonitorData();
  const machine = machines.find((m) => m.id === machineId);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  // Fetch ALL items for this machine (no project filter) so we can extract projects
  const { groups: allGroups, items: allItems, isLoading: dataLoading, error } = useStationData(machineId || null, machine?.type, null);
  const { isAdmin, isWorkshop } = useUserRole();
  const canWrite = isAdmin || isWorkshop;
  const [activeTab, setActiveTab] = useState("production");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [selectedBarListId, setSelectedBarListId] = useState<string | null>(null);
  const { pinnedMachineId, unpinMachine } = useTabletPin();
  const isPinned = pinnedMachineId === machineId;

  // Compute distinct projects from all items
  const projects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const item of allItems) {
      // Use project_id (UUID) as key to avoid name collisions between different projects
      const projKey = item.project_id || "__unassigned__";
      const existing = map.get(projKey);
      if (existing) {
        existing.count++;
      } else {
        map.set(projKey, {
          id: projKey,
          name: item.project_name || "Unassigned",
          count: 1,
        });
      }
    }
    return [...map.values()];
  }, [allItems]);

  // Auto-select if only one project
  useEffect(() => {
    if (projects.length === 1) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects]);

  // Filter items by selected project
  const items = useMemo(() => {
    if (!selectedProjectId) return allItems;
    return allItems.filter((i) => {
      const projKey = i.project_id || "__unassigned__";
      return projKey === selectedProjectId;
    });
  }, [allItems, selectedProjectId]);

  // Recompute groups from filtered items
  const groups = useMemo(() => {
    if (!selectedProjectId) return allGroups;
    return allGroups
      .map((g) => ({
        ...g,
        bendItems: g.bendItems.filter((i) => (i.project_id || "__unassigned__") === selectedProjectId),
        straightItems: g.straightItems.filter((i) => (i.project_id || "__unassigned__") === selectedProjectId),
      }))
      .filter((g) => g.bendItems.length > 0 || g.straightItems.length > 0);
  }, [allGroups, selectedProjectId]);

  // Compute distinct bar lists (scopes) from filtered items
  const barLists = useMemo(() => {
    const map = new Map<string, { id: string; name: string; projectName: string | null; count: number }>();
    for (const item of items) {
      const existing = map.get(item.cut_plan_id);
      if (existing) {
        existing.count++;
      } else {
        map.set(item.cut_plan_id, {
          id: item.cut_plan_id,
          name: item.plan_name,
          projectName: item.project_name,
          count: 1,
        });
      }
    }
    return [...map.values()];
  }, [items]);

  // Auto-select if only one scope; auto-reset if selected scope disappears
  useEffect(() => {
    if (barLists.length === 1) {
      setSelectedBarListId(barLists[0].id);
    } else if (selectedBarListId && !barLists.some((b) => b.id === selectedBarListId)) {
      setSelectedBarListId(null);
    }
  }, [barLists, selectedBarListId]);

  // Filtered views by barlist
  const filteredItems = selectedBarListId
    ? items.filter((i) => i.cut_plan_id === selectedBarListId)
    : items;

  // Auto-clear selectedItemId if the item no longer exists (e.g. moved to clearance) or list is empty
  useEffect(() => {
    if (selectedItemId && !filteredItems.some(i => i.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [filteredItems, selectedItemId]);

  const filteredGroups = selectedBarListId
    ? groups
        .map((g) => ({
          ...g,
          bendItems: g.bendItems.filter((i) => i.cut_plan_id === selectedBarListId),
          straightItems: g.straightItems.filter((i) => i.cut_plan_id === selectedBarListId),
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

  // PROJECT PICKER — shown when multiple projects and none selected
  if (projects.length > 1 && !selectedProjectId) {
    return (
      <div className="flex flex-col h-full">
        <StationHeader
          machineName={machine.name}
          machineModel={machine.model}
          canWrite={canWrite}
          isSupervisor={isSupervisor}
          onToggleSupervisor={() => setIsSupervisor((v) => !v)}
          showBedsSuffix={false}
        />
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold tracking-wider uppercase text-foreground">
                Select Active Project
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              This machine has items from multiple projects. Select one to avoid mixing barlists.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <FolderOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">
                      {proj.name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-0.5">
                      {proj.count} {proj.count === 1 ? "ITEM" : "ITEMS"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
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
        workspaceName={selectedProjectId && selectedProjectId !== "__unassigned__" ? projects.find(p => p.id === selectedProjectId)?.name : undefined}
      />

      {/* Back to project picker (only if multiple projects) */}
      {projects.length > 1 && selectedProjectId && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 px-2 text-primary hover:text-primary hover:bg-primary/10"
            onClick={() => {
              setSelectedProjectId(null);
              setSelectedBarListId(null);
              setSelectedItemId(null);
            }}
          >
            <ArrowLeft className="w-3 h-3" />
            Switch Project
          </Button>
          <span className="text-[10px] tracking-wider uppercase font-bold text-primary truncate">
            {projects.find(p => p.id === selectedProjectId)?.name}
          </span>
        </div>
      )}

      {/* Pinned indicator + unpin (supervisor only) */}
      {isPinned && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/5 border-b border-border">
          <Lock className="w-3 h-3 text-primary" />
          <span className="text-[10px] tracking-wider uppercase font-bold text-primary">
            Pinned to this device
          </span>
          {isSupervisor && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 text-[10px] gap-1 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => {
                unpinMachine();
                navigate("/shopfloor/station");
              }}
            >
              <Unlock className="w-3 h-3" />
              Unpin
            </Button>
          )}
        </div>
      )}

      <div className="px-4 pt-3">
        {/* Bar list (scope) selector — shown when multiple scopes present */}
        {barLists.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none">
            <button
              onClick={() => setSelectedBarListId(null)}
              className={cn(
                "shrink-0 text-[10px] font-bold tracking-wider px-3 py-1.5 rounded-full border transition-colors",
                !selectedBarListId
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
              )}
            >
              ALL ({items.length})
            </button>
            {barLists.map((bl) => (
              <button
                key={bl.id}
                onClick={() => setSelectedBarListId(bl.id)}
                className={cn(
                  "shrink-0 text-[10px] font-bold tracking-wider px-3 py-1.5 rounded-full border transition-colors max-w-[200px] truncate",
                  selectedBarListId === bl.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                )}
                title={bl.projectName ? `${bl.name} — ${bl.projectName}` : bl.name}
              >
                {bl.name} ({bl.count})
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
