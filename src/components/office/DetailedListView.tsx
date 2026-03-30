import { useCutPlans, useCutPlanItems } from "@/hooks/useCutPlans";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Pencil, Trash2, ChevronDown, ChevronRight, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUnitSystem, formatLength, barSizeLabel, sessionUnitToDisplay, displayModeToMm, type UnitSystem, type LengthDisplayMode } from "@/lib/unitSystem";

export function DetailedListView({ initialPlanId }: { initialPlanId?: string | null }) {
  const { plans, loading: plansLoading } = useCutPlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initialPlanId ?? null);
  const [sessionUnit, setSessionUnit] = useState<string | null>(null);

  // Sync when parent navigates with a new planId (e.g. Edit from Production Queue)
  useEffect(() => {
    setSelectedPlanId(initialPlanId ?? null);
  }, [initialPlanId]);
  const { items, loading: itemsLoading, fetchItems } = useCutPlanItems(selectedPlanId);
  const companyUnit = useUnitSystem();

  // Resolve session unit from cut_plan → barlist → extract_session
  useEffect(() => {
    if (!selectedPlanId) { setSessionUnit(null); return; }
    (async () => {
      const { data: plan } = await supabase
        .from("cut_plans")
        .select("barlist_id")
        .eq("id", selectedPlanId)
        .single();
      if (!plan?.barlist_id) { setSessionUnit(null); return; }
      const { data: barlist } = await supabase
        .from("barlists")
        .select("extract_session_id")
        .eq("id", plan.barlist_id)
        .single();
      if (!barlist?.extract_session_id) { setSessionUnit(null); return; }
      const { data: session } = await supabase
        .from("extract_sessions")
        .select("unit_system")
        .eq("id", barlist.extract_session_id)
        .single();
      setSessionUnit(session?.unit_system ?? null);
    })();
  }, [selectedPlanId]);

  // Use session unit if available, otherwise fall back to company unit
  const unitSystem: UnitSystem = sessionUnit ? sessionUnitToDisplay(sessionUnit) : companyUnit;
  // The LengthDisplayMode for converting user input back to mm
  const editUnit: LengthDisplayMode = (sessionUnit as LengthDisplayMode) || (companyUnit === "imperial" ? "imperial" : "mm");
  const qc = useQueryClient();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const startEdit = (item: any) => {
    setEditingItemId(item.id);
    setEditValues({
      mark_number: item.mark_number || "",
      total_pieces: item.total_pieces,
      cut_length_mm: item.cut_length_mm,
      bend_type: item.bend_type,
      asa_shape_code: item.asa_shape_code || "",
      drawing_ref: item.drawing_ref || "",
      bend_dimensions: { ...(item.bend_dimensions || {}) },
    });
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditValues({});
  };

  const saveEdit = async () => {
    if (!editingItemId) return;
    const { bend_dimensions, ...rest } = editValues;
    // Convert cut_length_mm from display unit back to mm
    const convertedLength = displayModeToMm(rest.cut_length_mm || 0, editUnit);
    // Convert dimension values from display unit back to mm
    const convertedDims: Record<string, number | undefined> = {};
    for (const [k, v] of Object.entries(bend_dimensions || {})) {
      convertedDims[k] = v ? displayModeToMm(Number(v), editUnit) : undefined;
    }
    const updatePayload: Record<string, any> = { ...rest, cut_length_mm: convertedLength, bend_dimensions: convertedDims };
    const { error } = await supabase
      .from("cut_plan_items")
      .update(updatePayload)
      .eq("id", editingItemId);
    if (error) {
      toast.error("Failed to save", { description: error.message });
      return;
    }
    toast.success("Item updated");
    setEditingItemId(null);
    setEditValues({});
    await fetchItems();
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  // Separate plans into active (running/draft/ready/queued) and completed
  const { activePlans, completedPlans } = useMemo(() => {
    const active: typeof plans = [];
    const completed: typeof plans = [];
    for (const plan of plans.filter(p => !p.name.endsWith("(Small)"))) {
      if (plan.status === "completed") {
        completed.push(plan);
      } else {
        active.push(plan);
      }
    }
    return { activePlans: active, completedPlans: completed };
  }, [plans]);

  // Group plans by customer_name, sorted alphabetically
  const groupByCustomer = (list: typeof plans) => {
    const groups: Record<string, typeof plans> = {};
    for (const plan of list) {
      const key = plan.customer_name || "Ungrouped";
      if (!groups[key]) groups[key] = [];
      groups[key].push(plan);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Ungrouped") return 1;
      if (b === "Ungrouped") return -1;
      return a.localeCompare(b);
    });
  };

  const activeGrouped = useMemo(() => groupByCustomer(activePlans), [activePlans]);
  const completedGrouped = useMemo(() => groupByCustomer(completedPlans), [completedPlans]);

  // Dimension columns
  const dimCols = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "O", "R"];

  if (!selectedPlanId) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-black italic text-foreground uppercase">Detailed List</h1>
        <p className="text-sm text-muted-foreground">Select a manifest to view its detailed item list.</p>
        {plansLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No manifests found.</p>
        ) : (
          <div className="space-y-6">
            {/* Active / Running section */}
            {activePlans.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-primary">
                  Active ({activePlans.length})
                </h2>
                {renderPlanGroups(activeGrouped)}
              </div>
            )}

            {/* Completed section */}
            {completedPlans.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Completed ({completedPlans.length})
                </h2>
                {renderPlanGroups(completedGrouped)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderPlanGroups(groups: [string, typeof plans][]) {
    return groups.map(([companyName, companyPlans]) => (
      <Collapsible key={companyName} defaultOpen>
        <CollapsibleTrigger className="w-full flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left group">
          <ChevronDown className="w-4 h-4 text-muted-foreground group-data-[state=closed]:hidden" />
          <ChevronRight className="w-4 h-4 text-muted-foreground group-data-[state=open]:hidden" />
          <span className="font-bold text-foreground uppercase text-sm tracking-wide">{companyName}</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {companyPlans.length}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-4 border-l-2 border-border/50 space-y-1 mt-1">
            {companyPlans.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`w-full text-left pl-4 pr-3 py-2.5 rounded-r-lg hover:bg-muted/30 transition-colors flex items-center justify-between ${plan.name.endsWith("(Small)") ? "opacity-60" : ""}`}
              >
                <span className="font-medium text-sm text-foreground flex items-center gap-2">
                  {plan.name}
                  {plan.name.endsWith("(Small)") && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-orange-500/40 text-orange-400">
                      AUTO-SPLIT
                    </Badge>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{plan.status}</span>
              </button>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    ));
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black italic text-foreground uppercase">
            {selectedPlan?.name || "Manifest"}
          </h1>
          <span className="text-xs text-primary/70 tracking-widest uppercase">
            Editing {items.length} Items
          </span>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedPlanId(null)}>
          <ArrowLeft className="w-4 h-4" />
          Back to Queue
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <div className="min-w-[1200px]">
          {/* Table header */}
          <div className="grid grid-cols-[60px_50px_60px_80px_60px_60px_50px_80px_repeat(12,60px)_70px] gap-0 px-4 py-2 bg-primary/10 border-b border-border text-[10px] font-bold tracking-widest text-primary uppercase sticky top-0">
            <span>DWG #</span>
            <span>Item</span>
            <span>Grade</span>
            <span>Mark</span>
            <span>Qty</span>
            <span>Size</span>
            <span>Type</span>
            <span>Length</span>
            {dimCols.map(c => <span key={c}>{c}</span>)}
            <span>ACT</span>
          </div>

          {/* Rows */}
          {itemsLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading items...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No items in this manifest.</div>
          ) : (
            items.map((item, idx) => {
              const dims = item.bend_dimensions || {};
              const isEditing = editingItemId === item.id;
              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-[60px_50px_60px_80px_60px_60px_50px_80px_repeat(12,60px)_70px] gap-0 px-4 py-2.5 border-b border-border/50 hover:bg-muted/30 text-sm items-center ${isEditing ? "bg-muted/40 ring-1 ring-primary/30" : ""}`}
                >
                  {/* DWG # */}
                  {isEditing ? (
                    <Input className="h-6 text-xs px-1 w-14" value={editValues.drawing_ref} onChange={e => setEditValues(v => ({ ...v, drawing_ref: e.target.value }))} />
                  ) : (
                    <span className="text-xs text-muted-foreground">{item.drawing_ref || "—"}</span>
                  )}
                  {/* Item # */}
                  <span className="text-xs text-muted-foreground">{idx + 1}</span>
                  {/* Grade */}
                  <span className="text-xs text-muted-foreground">400W</span>
                  {/* Mark */}
                  {isEditing ? (
                    <Input className="h-6 text-xs px-1 w-16" value={editValues.mark_number} onChange={e => setEditValues(v => ({ ...v, mark_number: e.target.value }))} />
                  ) : (
                    <span className="text-xs font-bold text-primary">{item.mark_number || item.id.slice(0, 5)}</span>
                  )}
                  {/* Qty */}
                  {isEditing ? (
                    <Input type="number" className="h-6 text-xs px-1 w-12" value={editValues.total_pieces} onChange={e => setEditValues(v => ({ ...v, total_pieces: parseInt(e.target.value) || 0 }))} />
                  ) : (
                    <span className="text-xs font-medium">{item.total_pieces}</span>
                  )}
                  {/* Size */}
                  <span className="text-xs">{barSizeLabel(item.bar_code, unitSystem)}</span>
                  {/* Type */}
                  {isEditing ? (
                    <Input className="h-6 text-xs px-1 w-12" value={editValues.asa_shape_code} onChange={e => setEditValues(v => ({ ...v, asa_shape_code: e.target.value }))} />
                  ) : (
                    <span>
                      {item.bend_type === "bend" ? (
                        <Badge className="bg-orange-500/20 text-orange-400 text-[9px] px-1">
                          {item.asa_shape_code || "BEND"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </span>
                  )}
                  {/* Length */}
                  {isEditing ? (
                    <Input type="number" className="h-6 text-xs px-1 w-16" value={editValues.cut_length_mm} onChange={e => setEditValues(v => ({ ...v, cut_length_mm: parseInt(e.target.value) || 0 }))} />
                  ) : (
                    <span className="text-xs font-bold">{formatLength(item.cut_length_mm, unitSystem)}</span>
                  )}
                  {/* Dim columns */}
                  {dimCols.map(c => (
                    isEditing ? (
                      <Input key={c} type="number" className="h-6 text-xs px-1 w-12" value={editValues.bend_dimensions?.[c] || ""} onChange={e => setEditValues(v => ({ ...v, bend_dimensions: { ...v.bend_dimensions, [c]: parseInt(e.target.value) || undefined } }))} />
                    ) : (
                      <span key={c} className="text-xs text-muted-foreground">
                        {dims[c] ? <span className="text-foreground">{dims[c]}<sub className="text-[8px] text-muted-foreground ml-0.5">{unitSystem === "imperial" ? "IN" : "MM"}</sub></span> : ""}
                      </span>
                    )
                  ))}
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <button className="text-primary hover:text-primary/80 transition-colors" onClick={saveEdit} title="Save">
                          <Check className="w-4 h-4" />
                        </button>
                        <button className="text-muted-foreground hover:text-destructive transition-colors" onClick={cancelEdit} title="Cancel">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => startEdit(item)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <DeleteItemButton itemId={item.id} markNumber={item.mark_number} />
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteItemButton({ itemId, markNumber }: { itemId: string; markNumber: string | null }) {
  const qc = useQueryClient();

  const handleDelete = async () => {
    const { data, error } = await supabase
      .from("cut_plan_items")
      .delete()
      .eq("id", itemId)
      .select();
    if (error) {
      toast.error("Permission denied", { description: error.message });
      return;
    }
    if (!data || data.length === 0) {
      toast.error("Permission denied", { description: "Item was not deleted — check your role." });
      return;
    }
    toast.success(`Item ${markNumber || itemId.slice(0, 5)} deleted`);
    qc.invalidateQueries({ queryKey: ["cut-plan-items"] });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Item</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete item <strong>{markNumber || itemId.slice(0, 5)}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
