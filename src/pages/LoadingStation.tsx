import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCompletedBundles, type CompletedBundle, type CompletedBundleItem } from "@/hooks/useCompletedBundles";
import { useLoadingChecklist } from "@/hooks/useLoadingChecklist";
import { ReadyBundleList } from "@/components/dispatch/ReadyBundleList";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  Package,
  ImageIcon,
  Truck,
  Eye,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

export default function LoadingStation() {
  const navigate = useNavigate();
  const { bundles, isLoading: bundlesLoading } = useCompletedBundles();
  const [selectedBundle, setSelectedBundle] = useState<CompletedBundle | null>(null);
  const { companyId } = useCompanyId();

  const {
    checklistMap,
    loadedCount,
    photoCount,
    isLoading: checklistLoading,
    initializeChecklist,
    toggleLoaded,
    uploadPhoto,
  } = useLoadingChecklist(selectedBundle?.cutPlanId ?? null);

  // Fetch ALL items for the selected cut plan (not just phase-filtered ones)
  const { data: allPlanItems = [], isLoading: planItemsLoading } = useQuery({
    queryKey: ["cut-plan-items-all", selectedBundle?.cutPlanId],
    enabled: !!selectedBundle?.cutPlanId && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cut_plan_items")
        .select("id, mark_number, drawing_ref, bar_code, cut_length_mm, total_pieces, asa_shape_code")
        .eq("cut_plan_id", selectedBundle!.cutPlanId)
        .eq("phase", "loading");
      if (error) throw error;
      return (data || []) as CompletedBundleItem[];
    },
  });

  // Use all plan items when available, fall back to bundle items
  const checklistItems: CompletedBundleItem[] =
    allPlanItems.length > 0 ? allPlanItems : selectedBundle?.items ?? [];

  // Initialize checklist rows when bundle is selected
  useEffect(() => {
    if (selectedBundle && checklistItems.length > 0) {
      const ids = checklistItems.map((i) => i.id);
      initializeChecklist(ids);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBundle?.cutPlanId, allPlanItems.length]);

  const totalItems = checklistItems.length;
  const progressPct = totalItems > 0 ? Math.round((loadedCount / totalItems) * 100) : 0;
  const allLoaded = totalItems > 0 && loadedCount === totalItems;

  // Guard: check if a delivery already exists for this cut plan
  const { data: existingDelivery } = useQuery({
    queryKey: ["delivery-for-plan", selectedBundle?.cutPlanId],
    enabled: !!selectedBundle?.cutPlanId && !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("deliveries")
        .select("id, packing_slips!inner(id)")
        .eq("cut_plan_id", selectedBundle!.cutPlanId)
        .eq("company_id", companyId!)
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Create delivery mutation
  const createDelivery = useMutation({
    mutationFn: async () => {
      if (!companyId || !selectedBundle) throw new Error("Missing context");

      const deliveryNumber = `DEL-${Date.now()}`;
      const slipNumber = `PS-${Date.now()}`;

      // 1. Insert delivery
      const { data: delivery, error: delErr } = await supabase
        .from("deliveries")
        .insert({
          delivery_number: deliveryNumber,
          status: "staged",
          company_id: companyId,
          cut_plan_id: selectedBundle.cutPlanId,
        })
        .select("id")
        .single();
      if (delErr) throw delErr;

      try {
        // 2. Insert delivery stop
        const { error: stopErr } = await supabase
          .from("delivery_stops")
          .insert({
            delivery_id: delivery.id,
            company_id: companyId,
            stop_sequence: 1,
          });
        if (stopErr) throw stopErr;

        // 3. Query project + customer data for packing slip header
        const { data: planData } = await supabase
          .from("cut_plans")
          .select("project_name, project_id, projects(name, site_address, customers(shipping_street1, shipping_city, shipping_province, shipping_postal_code))")
          .eq("id", selectedBundle.cutPlanId)
          .single();

        const project = (planData as any)?.projects;
        const customer = project?.customers;
        const shipTo = [
          customer?.shipping_street1,
          customer?.shipping_city,
          customer?.shipping_province,
          customer?.shipping_postal_code,
        ].filter(Boolean).join(", ") || null;
        const scope = project?.name || null;
        const siteAddress = project?.site_address || null;
        const deliveryDate = new Date().toISOString().slice(0, 10);

        // 4. Build items_json from checklist items
        const itemsJson = checklistItems.map((item) => ({
          id: item.id,
          mark_number: item.mark_number,
          drawing_ref: item.drawing_ref,
          bar_code: item.bar_code,
          cut_length_mm: item.cut_length_mm,
          total_pieces: item.total_pieces,
          asa_shape_code: item.asa_shape_code,
        }));

        // 5. Deterministic invoice resolution: extract_sessions (primary) → orders (fallback)
        let invoiceNumber: string | null = null;
        let invoiceDate: string | null = null;
        {
          const { data: cpiRow, error: cpiErr } = await supabase
            .from("cut_plan_items")
            .select("work_order_id")
            .eq("cut_plan_id", selectedBundle.cutPlanId)
            .not("work_order_id", "is", null)
            .limit(1)
            .maybeSingle();
          if (cpiErr) console.error("[Invoice] step1 cpi:", cpiErr.message);

          if (cpiRow?.work_order_id) {
            const { data: woRow, error: woErr } = await supabase
              .from("work_orders")
              .select("barlist_id, order_id")
              .eq("id", cpiRow.work_order_id)
              .single();
            if (woErr) console.error("[Invoice] step2 wo:", woErr.message);

            // Primary: extract_sessions via barlists
            if (woRow?.barlist_id) {
              const { data: blRow, error: blErr } = await supabase
                .from("barlists")
                .select("extract_session_id")
                .eq("id", woRow.barlist_id)
                .single();
              if (blErr) console.error("[Invoice] step3 barlist:", blErr.message);

              if (blRow?.extract_session_id) {
                const { data: esRow, error: esErr } = await supabase
                  .from("extract_sessions")
                  .select("invoice_number, invoice_date")
                  .eq("id", blRow.extract_session_id)
                  .single();
                if (esErr) console.error("[Invoice] step4 extract_session:", esErr.message);

                if (esRow) {
                  invoiceNumber = esRow.invoice_number || null;
                  invoiceDate = esRow.invoice_date
                    ? new Date(esRow.invoice_date).toISOString().slice(0, 10)
                    : null;
                }
              }
            }

            // Fallback: orders table (legacy)
            if ((!invoiceNumber || !invoiceDate) && woRow?.order_id) {
              const { data: orderRow, error: ordErr } = await supabase
                .from("orders")
                .select("order_number, order_date")
                .eq("id", woRow.order_id)
                .single();
              if (ordErr) console.error("[Invoice] fallback order:", ordErr.message);

              if (orderRow) {
                if (!invoiceNumber) invoiceNumber = orderRow.order_number || null;
                if (!invoiceDate) invoiceDate = orderRow.order_date
                  ? new Date(orderRow.order_date).toISOString().slice(0, 10)
                  : null;
              }
            }
          }

          // Final fallback: orders via cut_plan → project
          if ((!invoiceNumber || !invoiceDate) && (planData as any)?.project_id) {
            // @ts-ignore - deep type instantiation
            const { data: orderRow } = await supabase
              .from("orders")
              .select("order_number, order_date")
              .eq("project_id" as any, (planData as any).project_id)
              .order("created_at", { ascending: false } as any)
              .limit(1)
              .maybeSingle();
            if (orderRow) {
              if (!invoiceNumber) invoiceNumber = orderRow.order_number || null;
              if (!invoiceDate) invoiceDate = orderRow.order_date
                ? new Date(orderRow.order_date).toISOString().slice(0, 10)
                : null;
            }
          }
        }

        // 6. Insert packing slip with header fields
        const { error: slipErr } = await supabase
          .from("packing_slips")
          .insert({
            delivery_id: delivery.id,
            company_id: companyId,
            cut_plan_id: selectedBundle.cutPlanId,
            customer_name: selectedBundle.customerName || selectedBundle.projectName,
            items_json: itemsJson as any,
            slip_number: slipNumber,
            status: "draft",
            ship_to: shipTo,
            scope: scope,
            site_address: siteAddress,
            delivery_date: deliveryDate,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
          });
        if (slipErr) throw slipErr;
      } catch (innerErr) {
        // Cleanup: set to pending (trigger blocks delete of non-pending), then delete
        await supabase.from("delivery_stops").delete().eq("delivery_id", delivery.id);
        await supabase.from("deliveries").update({ status: "pending" }).eq("id", delivery.id);
        await supabase.from("deliveries").delete().eq("id", delivery.id);
        throw innerErr;
      }

      return delivery.id;
    },
    onSuccess: () => {
      toast.success("Delivery created successfully");
      navigate("/shopfloor/delivery-ops");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create delivery");
    },
  });

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/shop-floor")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-black italic uppercase tracking-wide text-foreground">
              Loading Station
            </h1>
            <p className="text-[9px] tracking-[0.2em] uppercase text-primary">
              Item-by-item truck loading with evidence
            </p>
          </div>
        </div>
        {selectedBundle && (
          <Badge variant="outline" className="font-mono text-xs">
            {loadedCount}/{totalItems} LOADED
          </Badge>
        )}
      </header>

      {!selectedBundle ? (
        /* Bundle Selection */
        <ScrollArea className="flex-1">
          <div className="p-4 sm:p-6">
            {bundlesLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : bundles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                <Package className="w-12 h-12 opacity-40" />
                <p className="text-sm">No cleared bundles ready for loading</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/shop-floor")}>
                  Back to Hub
                </Button>
              </div>
            ) : (
              <ReadyBundleList
                bundles={bundles}
                title="Select Bundle to Load"
                onSelect={setSelectedBundle}
              />
            )}
          </div>
        </ScrollArea>
      ) : (
        /* Loading Checklist */
        <>
          {/* Progress Section */}
          <div className="px-4 sm:px-6 py-4 border-b border-border bg-card/50">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-sm font-bold text-foreground">{selectedBundle.projectName}</h2>
                <p className="text-[10px] text-muted-foreground">{selectedBundle.planName}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedBundle(null)}>
                Change Bundle
              </Button>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{loadedCount} of {totalItems} items loaded</span>
                <span className="font-mono font-bold">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-3" />
            </div>
            {allLoaded && (
              <div className="mt-3">
                {existingDelivery ? (
                  <Button
                    className="w-full gap-2"
                    variant="outline"
                    onClick={() => navigate("/shopfloor/delivery-ops")}
                  >
                    <Eye className="w-4 h-4" />
                    VIEW DELIVERY
                  </Button>
                ) : (
                  <Button
                    className="w-full gap-2"
                    onClick={() => createDelivery.mutate()}
                    disabled={createDelivery.isPending}
                  >
                    {createDelivery.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Truck className="w-4 h-4" />
                    )}
                    CREATE DELIVERY
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Items Checklist */}
          <ScrollArea className="flex-1">
            <div className="p-4 sm:p-6 space-y-2">
              {checklistLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : planItemsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                checklistItems.map((item) => {
                  const checklist = checklistMap.get(item.id);
                  const isLoaded = checklist?.loaded ?? false;
                  const hasPhoto = !!checklist?.photo_path;

                  return (
                    <LoadingItemCard
                      key={item.id}
                      markNumber={item.mark_number}
                      barCode={item.bar_code}
                      cutLength={item.cut_length_mm}
                      pieces={item.total_pieces}
                      shapeCode={item.asa_shape_code}
                      isLoaded={isLoaded}
                      hasPhoto={hasPhoto}
                      onToggle={(loaded) => toggleLoaded.mutate({ itemId: item.id, loaded })}
                      onPhoto={(file) => uploadPhoto(item.id, file)}
                    />
                  );
                })
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

LoadingStation.displayName = "LoadingStation";

/* ---------- Sub-component ---------- */

interface LoadingItemCardProps {
  markNumber: string | null;
  barCode: string;
  cutLength: number;
  pieces: number;
  shapeCode: string | null;
  isLoaded: boolean;
  hasPhoto: boolean;
  onToggle: (loaded: boolean) => void;
  onPhoto: (file: File) => void;
}

function LoadingItemCard({
  markNumber,
  barCode,
  cutLength,
  pieces,
  shapeCode,
  isLoaded,
  hasPhoto,
  onToggle,
  onPhoto,
}: LoadingItemCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card className={`transition-all ${isLoaded ? "border-primary/40 bg-primary/5" : ""}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <Checkbox
          checked={isLoaded}
          onCheckedChange={(checked) => onToggle(!!checked)}
          className="h-6 w-6"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${isLoaded ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {markNumber || "No mark"}
            </span>
            <Badge variant="outline" className="text-[9px]">{barCode}</Badge>
          </div>
          <div className="text-[10px] text-muted-foreground flex gap-2 mt-0.5">
            <span>{cutLength}mm</span>
            <span>{pieces} pcs</span>
            {shapeCode && <span>Shape: {shapeCode}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {hasPhoto && <ImageIcon className="w-4 h-4 text-primary" />}
          {isLoaded && <CheckCircle2 className="w-4 h-4 text-primary" />}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="w-4 h-4" />
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPhoto(file);
              e.target.value = "";
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

LoadingItemCard.displayName = "LoadingItemCard";
