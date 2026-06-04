import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useClearanceData } from "@/hooks/useClearanceData";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  ChevronRight,
  AlertTriangle,
  Activity,
  WifiOff,
  Beaker,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ClearanceCard } from "@/components/clearance/ClearanceCard";
import { AutoClearanceMode } from "@/components/clearance/AutoClearanceMode";
import { ClearanceArchive } from "@/components/clearance/ClearanceArchive";
import { Zap, Hand, Archive as ArchiveIcon, ListChecks } from "lucide-react";
import { useReleaseState } from "@/hooks/useReleaseState";
import { manifestReleaseLabel } from "@/lib/releaseStateLabels";

const STORAGE_ZONES = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5", "Zone 6", "Zone 7"] as const;


export default function ClearanceStation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    items,
    byProjectKey,
    clearedCount,
    totalCount,
    isLoading,
    error,
    hasLive,
    sampleCount,
    triageCounts,
    dataUpdatedAt,
    isFetching,
  } = useClearanceData();
  const { isAdmin, isWorkshop } = useUserRole();
  const canWrite = isAdmin || isWorkshop;
  const { manifestStateById } = useReleaseState();

  // Track the active manifest by stable project key (project_id || "__unassigned__")
  // so it survives label/data changes after the last item is cleared.
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);
  const [selectedProjectLabel, setSelectedProjectLabel] = useState<string>("");
  const [autoMode, setAutoMode] = useState(false);
  const [listTab, setListTab] = useState<"manifests" | "archive">("manifests");
  const [zoneSaving, setZoneSaving] = useState(false);
  // Sample-data toggle: OFF by default when live data exists.
  // Forced ON when no live data exists, so the operator still sees something.
  const [showSamples, setShowSamples] = useState(false);
  const samplesVisible = showSamples || !hasLive;
  // Live-data health: green/amber/red derived from query freshness + error.
  const ageSec = Math.floor((Date.now() - (dataUpdatedAt || 0)) / 1000);
  const health: "live" | "stale" | "offline" =
    error ? "offline" : ageSec > 60 && !isFetching ? "stale" : "live";
  const queryClient = useQueryClient();
  const { toast } = useToast();


  // Resolve key → label/items from the live hook.
  const activeGroup = selectedProjectKey ? byProjectKey.get(selectedProjectKey) : undefined;

  // Pull the manifest's items from the FULL list (including just-cleared) so the
  // operator stays on the manifest page after clearing the last item.
  const activeItems = useMemo(() => {
    if (!selectedProjectKey) return [];
    const filtered = items.filter((i) => (i.cut_plan_id || "__unassigned__") === selectedProjectKey);
    // Urgency sort: needs_fix > stale > upstream_not_ready > pending > cleared,
    // then oldest first so the longest-waiting item floats to the top.
    return [...filtered].sort((a, b) => {
      if (b.urgency !== a.urgency) return b.urgency - a.urgency;
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ta - tb;
    });
  }, [items, selectedProjectKey]);
  const activeClearedCount = activeItems.filter((i) => i.evidence_status === "cleared").length;

  // Manifest-level storage zone: if every pending item shares the same zone, surface it.
  const pendingItems = activeItems.filter((i) => i.evidence_status !== "cleared");
  const manifestZone = useMemo(() => {
    if (pendingItems.length === 0) return "";
    const first = pendingItems[0].storage_zone || "";
    if (!first) return "";
    return pendingItems.every((i) => i.storage_zone === first) ? first : "";
  }, [pendingItems]);
  const allPendingHaveZone =
    pendingItems.length > 0 && pendingItems.every((i) => !!i.storage_zone);

  const applyZoneToManifest = async (zone: string) => {
    if (!canWrite || !zone) return;
    setZoneSaving(true);
    try {
      const targets = activeItems.filter((i) => i.evidence_status !== "cleared");
      const withEvidence = targets.filter((i) => i.evidence_id) as Array<typeof targets[number] & { evidence_id: string }>;
      const withoutEvidence = targets.filter((i) => !i.evidence_id);

      if (withEvidence.length > 0) {
        const { error } = await supabase
          .from("clearance_evidence")
          .update({ storage_zone: zone })
          .in("id", withEvidence.map((i) => i.evidence_id));
        if (error) throw error;
      }
      if (withoutEvidence.length > 0) {
        const { error } = await supabase
          .from("clearance_evidence")
          .insert(
            withoutEvidence.map((i) => ({
              cut_plan_item_id: i.id,
              storage_zone: zone,
            }))
          );
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["clearance-items"] });
      toast({ title: "Storage zone assigned", description: `${zone} · ${targets.length} item${targets.length !== 1 ? "s" : ""}` });
    } catch (err: any) {
      toast({ title: "Zone update failed", description: err.message, variant: "destructive" });
    } finally {
      setZoneSaving(false);
    }
  };


  // Manifest is "complete" when we had items and they're all cleared (group removed
  // from byProjectKey by the auto-advance trigger), and no pending items remain in view.
  const manifestComplete =
    !!selectedProjectKey &&
    !activeGroup &&
    activeItems.length > 0 &&
    activeClearedCount === activeItems.length;

  // Auto-return to project list ~4s after a manifest finishes, so kiosk doesn't get stuck.
  useEffect(() => {
    if (!manifestComplete) return;
    const t = setTimeout(() => {
      setSelectedProjectKey(null);
      setSelectedProjectLabel("");
    }, 4000);
    return () => clearTimeout(t);
  }, [manifestComplete]);

  // Sort plans by newest first (latestCreatedAt desc); fallback to label for stability.
  // Filters out sample-only groups when the toggle is off and live data exists.
  const projectEntries = useMemo(
    () =>
      [...byProjectKey.entries()]
        .filter(([, g]) => {
          if (samplesVisible) return true;
          // Drop groups where every item is sample.
          return g.items.some((i) => !i.is_sample);
        })
        .sort(([, a], [, b]) => {
          const diff = (b.latestCreatedAt || 0) - (a.latestCreatedAt || 0);
          if (diff !== 0) return diff;
          const sa = `${a.customerName || "~"}|${a.barlistName || a.label}`;
          const sb = `${b.customerName || "~"}|${b.barlistName || b.label}`;
          return sa.localeCompare(sb);
        }),
    [byProjectKey, samplesVisible]
  );

  // Group ALL barlists/cut-plans for the same customer together — across projects.
  type GroupVal = NonNullable<ReturnType<typeof byProjectKey.get>>;
  const customerGroups = useMemo(() => {
    const map = new Map<string, { customerName: string; latest: number; urgency: number; plans: Array<[string, GroupVal]> }>();
    for (const [key, group] of projectEntries) {
      const cname = group.customerName || "Unassigned";
      if (!map.has(cname)) map.set(cname, { customerName: cname, latest: 0, urgency: 0, plans: [] });
      const bucket = map.get(cname)!;
      bucket.plans.push([key, group as GroupVal]);
      if ((group.latestCreatedAt || 0) > bucket.latest) bucket.latest = group.latestCreatedAt || 0;
      const groupUrg = group.items.reduce((m, i) => Math.max(m, i.urgency || 0), 0);
      if (groupUrg > bucket.urgency) bucket.urgency = groupUrg;
    }
    // Urgent customers first (needs_fix / stale), then newest; Unassigned last.
    return [...map.values()].sort((a, b) => {
      if (a.customerName === "Unassigned") return 1;
      if (b.customerName === "Unassigned") return -1;
      if (b.urgency !== a.urgency) return b.urgency - a.urgency;
      return b.latest - a.latest;
    });
  }, [projectEntries]);

  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const toggleCustomer = (name: string) =>
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-destructive">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-60" />
        <p className="text-sm">Failed to load clearance data</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const displayLabel = activeGroup?.label || selectedProjectLabel;


  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (selectedProjectKey) {
                setSelectedProjectKey(null);
                setSelectedProjectLabel("");
              } else {
                navigate("/shop-floor");
              }
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold tracking-wider uppercase text-foreground">
              Clearance Station
            </h1>
            <p className="text-[10px] text-primary tracking-wider uppercase">
              QC Audit & Evidence Collection
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Live-data health pill */}
          <Badge
            variant="outline"
            data-testid="clearance-health-pill"
            className={`gap-1.5 text-[10px] px-2 py-1 tracking-wider uppercase font-bold ${
              health === "live"
                ? "border-primary/40 text-primary"
                : health === "stale"
                ? "border-amber-500/40 text-amber-600"
                : "border-destructive/40 text-destructive"
            }`}
            title={`Last refresh ${ageSec}s ago`}
          >
            {health === "offline" ? (
              <WifiOff className="w-3.5 h-3.5" />
            ) : (
              <Activity className={`w-3.5 h-3.5 ${health === "live" ? "animate-pulse" : ""}`} />
            )}
            {health === "live" ? `Live · ${totalCount}` : health === "stale" ? `Stale · ${ageSec}s` : "Offline"}
          </Badge>
          {/* Triage breakdown */}
          <div className="hidden sm:flex items-center gap-1" data-testid="triage-badges">
            <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive" title="Needs fix">
              FIX {triageCounts.needs_fix}
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-600" title="Stale > 24h">
              STALE {triageCounts.stale}
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1 border-muted-foreground/40 text-muted-foreground" title="Upstream not ready">
              UPSTREAM {triageCounts.upstream_not_ready}
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1" title="Pending">
              PEND {triageCounts.pending}
            </Badge>
            <Badge variant="default" className="text-[10px] gap-1" title="Cleared">
              OK {triageCounts.cleared}
            </Badge>
          </div>
          {/* Sample toggle */}
          {sampleCount > 0 && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-border" title="Show sample / demo rows">
              <Beaker className="w-3.5 h-3.5 text-muted-foreground" />
              <Label htmlFor="sample-toggle" className="text-[10px] uppercase tracking-wider text-muted-foreground cursor-pointer">
                Samples ({sampleCount})
              </Label>
              <Switch
                id="sample-toggle"
                checked={samplesVisible}
                disabled={!hasLive}
                onCheckedChange={setShowSamples}
                aria-label="Show sample data"
              />
            </div>
          )}
          <Badge variant="outline" className="gap-1.5 text-sm px-3 py-1">
            <ShieldCheck className="w-4 h-4" />
            {clearedCount} / {totalCount} Cleared
          </Badge>
        </div>
      </div>
      {!hasLive && sampleCount > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-1.5 text-[11px] text-amber-700 dark:text-amber-400 text-center">
          Showing sample data — no live clearance items yet.
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        {totalCount === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No items awaiting clearance</p>
          </div>
        ) : !selectedProjectKey ? (
          <div className="p-4 space-y-3">
            <div className="inline-flex rounded-lg border border-border overflow-hidden mb-1">
              <button
                onClick={() => setListTab("manifests")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase ${listTab === "manifests" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50"}`}
              >
                <ListChecks className="w-3.5 h-3.5" /> Manifests
              </button>
              <button
                onClick={() => setListTab("archive")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase border-l border-border ${listTab === "archive" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50"}`}
              >
                <ArchiveIcon className="w-3.5 h-3.5" /> Archive
              </button>
            </div>
            {listTab === "archive" ? (
              <ClearanceArchive />
            ) : (
              <>
            <p className="text-sm text-muted-foreground mb-2">
              Select a customer to view its clearance manifests.
            </p>
            {customerGroups.map(({ customerName, plans }) => {
              const allItems = plans.flatMap(([, g]) => g.items);
              const cleared = allItems.filter((i) => i.evidence_status === "cleared").length;
              const totalPlanItems = allItems.length;
              const isSingle = plans.length === 1;
              const isExpanded = expandedCustomers.has(customerName) || isSingle;
              const customerIsSample = allItems.length > 0 && allItems.every((i) => i.is_sample);
              const needsFixCount = allItems.filter((i) => i.triage === "needs_fix").length;
              const staleCount = allItems.filter((i) => i.triage === "stale").length;

              return (
                <div
                  key={customerName}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <button
                    onClick={() => {
                      if (isSingle) {
                        const [key, group] = plans[0];
                        setSelectedProjectKey(key);
                        setSelectedProjectLabel(group.label);
                      } else {
                        toggleCustomer(customerName);
                      }
                    }}
                    className="w-full hover:bg-muted/50 transition-colors p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                      <div className="min-w-0 flex flex-col">
                        <span className="text-base font-bold uppercase tracking-wider text-white truncate flex items-center gap-2">
                          {customerName}
                          {customerIsSample && (
                            <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-600">
                              SAMPLE
                            </Badge>
                          )}
                        </span>
                        <span className="text-[10px] font-bold tracking-wide uppercase text-primary truncate">
                          {plans.length} manifest{plans.length !== 1 ? "s" : ""} · {totalPlanItems} item{totalPlanItems !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {needsFixCount > 0 && (
                        <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                          FIX {needsFixCount}
                        </Badge>
                      )}
                      {staleCount > 0 && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                          STALE {staleCount}
                        </Badge>
                      )}
                      <Badge
                        variant={cleared === totalPlanItems ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {cleared === totalPlanItems ? "complete" : `${cleared}/${totalPlanItems}`}
                      </Badge>
                      <ChevronRight
                        className={`w-5 h-5 text-muted-foreground transition-transform ${isExpanded && !isSingle ? "rotate-90" : ""}`}
                      />
                    </div>
                  </button>


                  {isExpanded && !isSingle && (
                    <div className="border-t border-border bg-background/40">
                      {plans.map(([key, group]) => {
                        const planCleared = group.items.filter((i) => i.evidence_status === "cleared").length;
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              setSelectedProjectKey(key);
                              setSelectedProjectLabel(group.label);
                            }}
                            className="w-full hover:bg-muted/50 transition-colors px-4 py-3 flex items-center justify-between text-left border-t border-border/50 first:border-t-0"
                          >
                            <div className="flex items-center gap-3 min-w-0 pl-6">
                              <div className="min-w-0 flex flex-col">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-[12px] text-foreground truncate">
                                    └─ {group.barlistName || group.label}
                                  </span>
                                  {typeof group.barlistRevisionNo === "number" && (
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                      R{group.barlistRevisionNo}
                                    </span>
                                  )}
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
                                    {manifestReleaseLabel(manifestStateById.get(key)).toUpperCase()}
                                  </Badge>

                                </div>
                                <span className="text-[10px] font-bold tracking-wide uppercase text-primary/70 truncate">
                                  {group.items.length} item{group.items.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant={planCleared === group.items.length ? "default" : "secondary"}
                                className="text-[10px]"
                              >
                                {planCleared === group.items.length ? "complete" : `${planCleared}/${group.items.length}`}
                              </Badge>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
              </>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold tracking-wider uppercase text-foreground truncate">
                Manifest: {displayLabel}
              </h2>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {activeClearedCount} / {activeItems.length}
              </Badge>
              {!manifestComplete && canWrite && pendingItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Storage zone
                  </span>
                  <Select
                    value={manifestZone || undefined}
                    onValueChange={(z) => {
                      // Changing zone while a clearance session is in progress
                      // (auto camera open) requires confirmation so the operator
                      // doesn't accidentally lose context.
                      if (autoMode && manifestZone && z !== manifestZone) {
                        const ok = window.confirm(
                          "Changing zone will reset current clearance session view. Continue?",
                        );
                        if (!ok) return;
                        setAutoMode(false);
                      }
                      applyZoneToManifest(z);
                    }}
                    disabled={zoneSaving}
                  >
                    <SelectTrigger className="h-8 text-xs w-[140px]" aria-label="Manifest storage zone">
                      <SelectValue placeholder="Select zone…" />
                    </SelectTrigger>
                    <SelectContent>
                      {STORAGE_ZONES.map((z) => (
                        <SelectItem key={z} value={z} className="text-xs">
                          {z}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!manifestZone && (
                    <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-600">
                      Required
                    </Badge>
                  )}
                  {manifestZone && !allPendingHaveZone && (
                    <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-600">
                      Some items missing zone
                    </Badge>
                  )}
                </div>
              )}
              {!manifestComplete && canWrite && activeItems.some((i) => i.evidence_status !== "cleared") && (
                <div className="ml-auto inline-flex rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => {
                      if (!manifestZone) {
                        toast({ title: "Select zone before clearance.", variant: "destructive" });
                        return;
                      }
                      setAutoMode(false);
                    }}
                    disabled={!manifestZone}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase disabled:opacity-40 disabled:cursor-not-allowed ${!autoMode ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50"}`}
                  >
                    <Hand className="w-3.5 h-3.5" /> Manual
                  </button>
                  <button
                    onClick={() => {
                      if (!manifestZone) {
                        toast({ title: "Select zone before clearance.", variant: "destructive" });
                        return;
                      }
                      setAutoMode(true);
                    }}
                    disabled={!manifestZone}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase border-l border-border disabled:opacity-40 disabled:cursor-not-allowed ${autoMode ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50"}`}
                  >
                    <Zap className="w-3.5 h-3.5" /> Auto Clearance
                  </button>
                </div>
              )}

            </div>
            {!manifestZone && !manifestComplete && pendingItems.length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-center">
                <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-sm font-bold tracking-wider uppercase text-foreground">
                  Select zone before clearance
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Pick a storage zone above to enable Manual Verify and Auto Clearance.
                </p>
              </div>
            )}
            {manifestComplete ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
                <ShieldCheck className="w-10 h-10 text-primary mx-auto" />
                <p className="text-sm font-bold tracking-wider uppercase text-foreground">
                  Manifest Complete
                </p>
                <p className="text-xs text-muted-foreground">
                  All items cleared. Returning to projects shortly…
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProjectKey(null);
                    setSelectedProjectLabel("");
                    setAutoMode(false);
                  }}
                >
                  Back to Projects
                </Button>
              </div>
            ) : autoMode && canWrite && manifestZone ? (
              <AutoClearanceMode
                items={activeItems}
                manifestLabel={displayLabel}
                manifestKey={selectedProjectKey!}
                userId={user?.id}
                selectedZone={manifestZone}
                onExit={() => setAutoMode(false)}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeItems.map((item) => (
                  <ClearanceCard
                    key={item.id}
                    item={item}
                    canWrite={canWrite}
                    userId={user?.id}
                  />
                ))}
              </div>
            )}
          </div>

        )}
      </ScrollArea>
    </div>
  );
}
