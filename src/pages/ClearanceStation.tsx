import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useClearanceData } from "@/hooks/useClearanceData";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { ClearanceCard } from "@/components/clearance/ClearanceCard";
import { AutoClearanceMode } from "@/components/clearance/AutoClearanceMode";
import { Zap, Hand } from "lucide-react";

export default function ClearanceStation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, byProjectKey, clearedCount, totalCount, isLoading, error } = useClearanceData();
  const { isAdmin, isWorkshop } = useUserRole();
  const canWrite = isAdmin || isWorkshop;

  // Track the active manifest by stable project key (project_id || "__unassigned__")
  // so it survives label/data changes after the last item is cleared.
  const [selectedProjectKey, setSelectedProjectKey] = useState<string | null>(null);
  // Cache the label of the active manifest so we can keep showing it even after
  // the project group disappears from byProjectKey on completion.
  const [selectedProjectLabel, setSelectedProjectLabel] = useState<string>("");

  // Resolve key → label/items from the live hook.
  const activeGroup = selectedProjectKey ? byProjectKey.get(selectedProjectKey) : undefined;

  // Pull the manifest's items from the FULL list (including just-cleared) so the
  // operator stays on the manifest page after clearing the last item.
  const activeItems = useMemo(() => {
    if (!selectedProjectKey) return [];
    return items.filter((i) => (i.cut_plan_id || "__unassigned__") === selectedProjectKey);
  }, [items, selectedProjectKey]);
  const activeClearedCount = activeItems.filter((i) => i.evidence_status === "cleared").length;

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
  const projectEntries = useMemo(
    () =>
      [...byProjectKey.entries()].sort(([, a], [, b]) => {
        const diff = (b.latestCreatedAt || 0) - (a.latestCreatedAt || 0);
        if (diff !== 0) return diff;
        const sa = `${a.customerName || "~"}|${a.barlistName || a.label}`;
        const sb = `${b.customerName || "~"}|${b.barlistName || b.label}`;
        return sa.localeCompare(sb);
      }),
    [byProjectKey]
  );

  // Group ALL barlists/cut-plans for the same customer together — across projects.
  type GroupVal = NonNullable<ReturnType<typeof byProjectKey.get>>;
  const customerGroups = useMemo(() => {
    const map = new Map<string, { customerName: string; latest: number; plans: Array<[string, GroupVal]> }>();
    for (const [key, group] of projectEntries) {
      const cname = group.customerName || "Unassigned";
      if (!map.has(cname)) map.set(cname, { customerName: cname, latest: 0, plans: [] });
      const bucket = map.get(cname)!;
      bucket.plans.push([key, group as GroupVal]);
      if ((group.latestCreatedAt || 0) > bucket.latest) bucket.latest = group.latestCreatedAt || 0;
    }
    // Newest customer first; Unassigned last
    return [...map.values()].sort((a, b) => {
      if (a.customerName === "Unassigned") return 1;
      if (b.customerName === "Unassigned") return -1;
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
  const formatStatus = (status: string | null) =>
    (status || "pending").replace(/_/g, " ").toUpperCase();

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
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 text-sm px-3 py-1">
            <ShieldCheck className="w-4 h-4" />
            {clearedCount} / {totalCount} Cleared
          </Badge>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {totalCount === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No items awaiting clearance</p>
          </div>
        ) : !selectedProjectKey ? (
          <div className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground mb-2">
              Select a customer to view its clearance manifests.
            </p>
            {customerGroups.map(({ customerName, plans }) => {
              const allItems = plans.flatMap(([, g]) => g.items);
              const cleared = allItems.filter((i) => i.evidence_status === "cleared").length;
              const totalPlanItems = allItems.length;
              const isSingle = plans.length === 1;
              const isExpanded = expandedCustomers.has(customerName) || isSingle;

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
                        <span className="text-base font-bold uppercase tracking-wider text-white truncate">
                          {customerName}
                        </span>
                        <span className="text-[10px] font-bold tracking-wide uppercase text-primary truncate">
                          {plans.length} manifest{plans.length !== 1 ? "s" : ""} · {totalPlanItems} item{totalPlanItems !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
                                    {formatStatus(group.barlistStatus || group.cutPlanStatus || null)}
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
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-bold tracking-wider uppercase text-foreground truncate">
                Manifest: {displayLabel}
              </h2>
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {activeClearedCount} / {activeItems.length}
              </Badge>
            </div>
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
                  }}
                >
                  Back to Projects
                </Button>
              </div>
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
