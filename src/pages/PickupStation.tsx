import { useState, useEffect, useRef, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePickupOrders, usePickupOrderItems } from "@/hooks/usePickupOrders";
import { useCompletedBundles, type CompletedBundle } from "@/hooks/useCompletedBundles";
import { useLoadingChecklist } from "@/hooks/useLoadingChecklist";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { useCompanyId } from "@/hooks/useCompanyId";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PickupVerification } from "@/components/shopfloor/PickupVerification";
import { ReadyBundleList } from "@/components/dispatch/ReadyBundleList";
import { PackingSlipPreview } from "@/components/delivery/PackingSlipPreview";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Package, MapPin, ArrowLeft, AlertTriangle, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  ready: "bg-success/20 text-success",
  collected: "bg-primary/20 text-primary",
  released: "bg-warning/20 text-warning",
};

const PickupStation = forwardRef<HTMLDivElement>(function PickupStation(_props, ref) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders, loading, error, authorizeRelease } = usePickupOrders();
  const { isAdmin, isWorkshop } = useUserRole();
  const canWrite = isAdmin || isWorkshop;

  const { companyId } = useCompanyId();

  const { bundles } = useCompletedBundles({ pickupOnly: true });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<CompletedBundle | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [showSlipPreview, setShowSlipPreview] = useState(false);
  const slipMetaRef = useRef<any>(null);
  const queryClient = useQueryClient();

  const { checklistMap } = useLoadingChecklist(selectedBundle?.cutPlanId ?? null);

  // Guard: check if packing slip already exists for this bundle's cut plan
  const { data: existingDelivery } = useQuery({
    queryKey: ["pickup-delivery-for-plan", selectedBundle?.cutPlanId],
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

  // Create packing slip mutation (same pattern as LoadingStation)
  const createPackingSlip = useMutation({
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

        // 3. Query project + customer data
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

        // 4. Build items_json from checked items only
        const selectedItems = selectedBundle.items.filter((i) => checkedItems.has(i.id));
        const itemsJson = selectedItems.map((item) => ({
          id: item.id,
          mark_number: item.mark_number,
          drawing_ref: item.drawing_ref,
          bar_code: item.bar_code,
          cut_length_mm: item.cut_length_mm,
          total_pieces: item.total_pieces,
          asa_shape_code: item.asa_shape_code,
        }));

        // 5. Invoice resolution chain
        let invoiceNumber: string | null = null;
        let invoiceDate: string | null = null;
        {
          const { data: cpiRow } = await supabase
            .from("cut_plan_items")
            .select("work_order_id")
            .eq("cut_plan_id", selectedBundle.cutPlanId)
            .not("work_order_id", "is", null)
            .limit(1)
            .maybeSingle();

          if (cpiRow?.work_order_id) {
            const { data: woRow } = await supabase
              .from("work_orders")
              .select("barlist_id, order_id")
              .eq("id", cpiRow.work_order_id)
              .single();

            if (woRow?.barlist_id) {
              const { data: blRow } = await supabase
                .from("barlists")
                .select("extract_session_id")
                .eq("id", woRow.barlist_id)
                .single();

              if (blRow?.extract_session_id) {
                const { data: esRow } = await supabase
                  .from("extract_sessions")
                  .select("invoice_number, invoice_date")
                  .eq("id", blRow.extract_session_id)
                  .single();

                if (esRow) {
                  invoiceNumber = esRow.invoice_number || null;
                  invoiceDate = esRow.invoice_date
                    ? new Date(esRow.invoice_date).toISOString().slice(0, 10)
                    : null;
                }
              }
            }

            if ((!invoiceNumber || !invoiceDate) && woRow?.order_id) {
              const { data: orderRow } = await supabase
                .from("orders")
                .select("order_number, order_date")
                .eq("id", woRow.order_id)
                .single();
              if (orderRow) {
                if (!invoiceNumber) invoiceNumber = orderRow.order_number || null;
                if (!invoiceDate) invoiceDate = orderRow.order_date
                  ? new Date(orderRow.order_date).toISOString().slice(0, 10)
                  : null;
              }
            }
          }

          if ((!invoiceNumber || !invoiceDate) && (planData as any)?.project_id) {
            // @ts-ignore
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

        // 6. Insert packing slip
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

        // Store resolved metadata for preview
        slipMetaRef.current = {
          slipMeta: {
            slipNumber,
            invoiceNumber: invoiceNumber || undefined,
            invoiceDate: invoiceDate || undefined,
            shipTo: shipTo || undefined,
            scope: scope || undefined,
            deliveryDate,
          },
          customerName: selectedBundle.customerName || selectedBundle.projectName || "",
          siteAddress: siteAddress || "",
          items: itemsJson,
        };
      } catch (innerErr) {
        await supabase.from("delivery_stops").delete().eq("delivery_id", delivery.id);
        await supabase.from("deliveries").update({ status: "pending" }).eq("id", delivery.id);
        await supabase.from("deliveries").delete().eq("id", delivery.id);
        throw innerErr;
      }

      return delivery.id;
    },
    onSuccess: () => {
      toast.success("Packing slip created");
      queryClient.invalidateQueries({ queryKey: ["pickup-delivery-for-plan", selectedBundle?.cutPlanId] });
      if (slipMetaRef.current) {
        setShowSlipPreview(true);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create packing slip");
    },
  });

  // Resolve signed URLs for loading photos
  useEffect(() => {
    if (!selectedBundle || checklistMap.size === 0) return;
    const resolve = async () => {
      const urls = new Map<string, string>();
      for (const item of selectedBundle.items) {
        const cl = checklistMap.get(item.id);
        if (cl?.photo_path) {
          const { data } = await supabase.storage
            .from("clearance-photos")
            .createSignedUrl(cl.photo_path, 3600);
          if (data?.signedUrl) urls.set(item.id, data.signedUrl);
        }
      }
      setPhotoUrls(urls);
    };
    resolve();
  }, [selectedBundle, checklistMap]);

  // Reset checked items when bundle changes
  useEffect(() => {
    if (selectedBundle) {
      setCheckedItems(new Set(selectedBundle.items.map((i) => i.id)));
    }
  }, [selectedBundle]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || null;
  const { items, toggleVerified } = usePickupOrderItems(selectedOrderId);

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!selectedBundle) return;
    if (checkedItems.size === selectedBundle.items.length) {
      setCheckedItems(new Set());
    } else {
      setCheckedItems(new Set(selectedBundle.items.map((i) => i.id)));
    }
  };

  if (selectedBundle) {
    const allChecked = checkedItems.size === selectedBundle.items.length;
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedBundle(null); setCheckedItems(new Set()); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{selectedBundle.projectName}</h1>
            <p className="text-xs text-muted-foreground">{selectedBundle.planName} • {selectedBundle.items.length} items • {selectedBundle.totalPieces} pcs</p>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
            {allChecked ? "Deselect All" : "Select All"}
          </Button>
        </header>
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="grid gap-3">
            {selectedBundle.items.map((item) => {
              const photoUrl = photoUrls.get(item.id);
              return (
                <Card key={item.id} className={`cursor-pointer transition-all ${checkedItems.has(item.id) ? "border-primary/50 bg-primary/5" : ""}`} onClick={() => toggleItem(item.id)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Checkbox
                      checked={checkedItems.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                    {photoUrl ? (
                      <img src={photoUrl} alt="Loading evidence" className="w-10 h-10 rounded object-cover shrink-0 border border-border" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{item.mark_number || "No mark"}</span>
                      <p className="text-xs text-muted-foreground">{item.cut_length_mm}mm • {item.total_pieces} pcs</p>
                    </div>
                    <Badge variant="outline">{item.bar_code}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
        {/* Sticky footer */}
        <div className="border-t border-border px-4 sm:px-6 py-3 flex items-center justify-between bg-background">
          <span className="text-sm text-muted-foreground">
            {checkedItems.size} of {selectedBundle.items.length} selected
          </span>
          {existingDelivery ? (
            <Badge
              variant="outline"
              className="text-success border-success/40 gap-1 cursor-pointer hover:bg-success/10 transition-colors"
              onClick={async () => {
                // Load existing packing slip data for preview
                const slipId = (existingDelivery as any)?.packing_slips?.[0]?.id;
                if (!slipId) return;
                const { data: slip } = await supabase
                  .from("packing_slips")
                  .select("*")
                  .eq("id", slipId)
                  .single();
                if (slip) {
                  slipMetaRef.current = {
                    slipMeta: {
                      slipNumber: slip.slip_number || undefined,
                      invoiceNumber: slip.invoice_number || undefined,
                      invoiceDate: slip.invoice_date || undefined,
                      shipTo: slip.ship_to || undefined,
                      scope: slip.scope || undefined,
                      deliveryDate: slip.delivery_date || undefined,
                    },
                    customerName: slip.customer_name || "",
                    siteAddress: slip.site_address || "",
                    items: (slip.items_json as any[]) || [],
                  };
                  setShowSlipPreview(true);
                }
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Packing Slip Created
            </Badge>
          ) : (
            <Button
              size="sm"
              disabled={checkedItems.size === 0 || createPackingSlip.isPending}
              onClick={() => createPackingSlip.mutate()}
            >
              {createPackingSlip.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <FileText className="w-4 h-4 mr-1" />
              )}
              Generate Packing Slip
            </Button>
          )}
        </div>

        {/* Packing Slip Preview overlay */}
        {showSlipPreview && slipMetaRef.current && (
          <PackingSlipPreview
            slipMeta={slipMetaRef.current.slipMeta}
            customerName={slipMetaRef.current.customerName}
            siteAddress={slipMetaRef.current.siteAddress}
            items={slipMetaRef.current.items}
            signatureData={null}
            onClose={() => setShowSlipPreview(false)}
          />
        )}
      </div>
    );
  }

  if (selectedOrder) {
    return (
      <PickupVerification
        order={selectedOrder}
        items={items}
        onToggleVerified={toggleVerified}
        onAuthorize={async (sig) => {
          if (user) {
            await authorizeRelease(selectedOrder.id, sig, user.id);
            setSelectedOrderId(null);
          }
        }}
        onBack={() => setSelectedOrderId(null)}
        canWrite={canWrite}
      />
    );
  }

  // Fix 4: Error state
  if (error) {
    return (
      <div className="text-center py-20 text-destructive">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-60" />
        <p className="text-sm">Failed to load pickup orders</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/shop-floor")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-wide uppercase">Pickup Station</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verify identity and authorize material release
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {/* Ready bundles from clearance */}
        <ReadyBundleList
          bundles={bundles}
          title="Cleared — Ready for Pickup"
          onSelect={setSelectedBundle}
        />

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 && bundles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
            <Package className="w-10 h-10" />
            <p>No pickup orders found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => (
              <Card
                key={order.id}
                className="cursor-pointer hover:border-primary/40 transition-all"
                onClick={() => setSelectedOrderId(order.id)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold text-sm uppercase">
                        {order.site_address}
                      </span>
                    </div>
                    <Badge className={statusColors[order.status] || statusColors.pending}>
                      {order.status.toUpperCase()}
                    </Badge>
                  </div>

                  {order.customer && (
                    <p className="text-xs text-muted-foreground">
                      {order.customer.company_name || order.customer.name}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono">{order.bundle_count} Bundles</span>
                    <span>For Collection</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default PickupStation;
