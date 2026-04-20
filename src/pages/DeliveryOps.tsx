import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { ArrowLeft, Truck, Package, Loader2, Calendar, User, Car, Trash2, CheckSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ReadyToShipBoard } from "@/components/logistics/ReadyToShipBoard";

interface DeliveryCard {
  id: string;
  delivery_number: string;
  status: string;
  scheduled_date: string | null;
  customer_name: string | null;
  stop_id: string | null;
  item_count: number;
  bundle_summary: string;
  site_address: string | null;
  order_number: string | null;
  due_date: string | null;
  driver_name: string | null;
  vehicle: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "PENDING",
  staged: "STAGED AT SHOP",
  scheduled: "SCHEDULED",
  "in-transit": "IN TRANSIT",
  delivered: "DELIVERED",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  staged: "bg-amber-500/20 text-amber-400",
  scheduled: "bg-primary/20 text-primary",
  "in-transit": "bg-blue-500/20 text-blue-400",
  delivered: "bg-emerald-500/20 text-emerald-400",
};

export default function DeliveryOps() {
  const { companyId } = useCompanyId();
  const [cards, setCards] = useState<DeliveryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleTarget, setScheduleTarget] = useState<DeliveryCard | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryCard | null>(null);
  const [schedForm, setSchedForm] = useState({ driver_name: "", vehicle: "", scheduled_date: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === cards.length) return new Set();
      return new Set(cards.map((c) => c.id));
    });
  }, [cards]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const allSelected = cards.length > 0 && selectedIds.size === cards.length;
  const someSelected = selectedIds.size > 0;

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);

    const { data: deliveries } = await supabase
      .from("deliveries")
      .select("id, delivery_number, status, scheduled_date, order_id, driver_name, vehicle")
      .eq("company_id", companyId)
      .in("status", ["staged", "scheduled", "in-transit"])
      .order("created_at", { ascending: false });

    if (!deliveries?.length) {
      setCards([]);
      setLoading(false);
      return;
    }

    const deliveryIds = deliveries.map((d) => d.id);
    const orderIds = deliveries.map((d) => d.order_id).filter(Boolean) as string[];

    const [{ data: stops }, { data: slips }, { data: orderData }] = await Promise.all([
      supabase
        .from("delivery_stops")
        .select("id, delivery_id, address, stop_sequence")
        .in("delivery_id", deliveryIds)
        .order("stop_sequence", { ascending: true }),
      supabase
        .from("packing_slips")
        .select("delivery_id, customer_name, items_json, site_address")
        .in("delivery_id", deliveryIds),
      orderIds.length > 0
        ? supabase
            .from("orders")
            .select("id, order_number, due_date, customers(name)")
            .in("id", orderIds)
        : Promise.resolve({ data: [] }),
    ]);

    const stopMap = new Map<string, { id: string; address: string | null }>();
    stops?.forEach((s) => {
      if (!stopMap.has(s.delivery_id)) {
        stopMap.set(s.delivery_id, { id: s.id, address: s.address });
      }
    });

    const slipMap = new Map<string, { customer_name: string | null; item_count: number; site_address: string | null }>();
    slips?.forEach((s) => {
      const items = Array.isArray(s.items_json) ? s.items_json : [];
      const existing = slipMap.get(s.delivery_id!);
      slipMap.set(s.delivery_id!, {
        customer_name: existing?.customer_name || s.customer_name,
        item_count: (existing?.item_count || 0) + items.length,
        site_address: existing?.site_address || s.site_address,
      });
    });

    const orderMap = new Map<string, any>();
    (orderData || []).forEach((o: any) => orderMap.set(o.id, o));

    const result: DeliveryCard[] = deliveries.map((d) => {
      const stop = stopMap.get(d.id);
      const slip = slipMap.get(d.id);
      const order = d.order_id ? orderMap.get(d.order_id) : null;
      const itemCount = slip?.item_count || 0;
      const customerName = slip?.customer_name || order?.customers?.name || d.delivery_number;
      return {
        id: d.id,
        delivery_number: d.delivery_number,
        status: d.status || "pending",
        scheduled_date: d.scheduled_date,
        customer_name: customerName,
        stop_id: stop?.id || null,
        item_count: itemCount,
        bundle_summary: `${itemCount} item${itemCount !== 1 ? "s" : ""} for site drop`,
        site_address: slip?.site_address || stop?.address,
        order_number: order?.order_number || null,
        due_date: order?.due_date || null,
        driver_name: d.driver_name,
        vehicle: d.vehicle,
      };
    });

    setCards(result);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [companyId]);

  // Clear selection when cards change
  useEffect(() => {
    setSelectedIds((prev) => {
      const cardIdSet = new Set(cards.map((c) => c.id));
      const next = new Set<string>();
      prev.forEach((id) => { if (cardIdSet.has(id)) next.add(id); });
      return next;
    });
  }, [cards]);

  const handleSchedule = async () => {
    if (!scheduleTarget) return;
    if (!schedForm.driver_name || !schedForm.vehicle || !schedForm.scheduled_date) {
      toast.error("Driver, vehicle, and date are all required");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("deliveries")
      .update({
        driver_name: schedForm.driver_name,
        vehicle: schedForm.vehicle,
        scheduled_date: schedForm.scheduled_date,
        status: "scheduled",
      })
      .eq("id", scheduleTarget.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Delivery scheduled");
      setScheduleTarget(null);
      fetchData();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const id = deleteTarget.id;
    await supabase.from("packing_slips").delete().eq("delivery_id", id);
    await supabase.from("delivery_stops").delete().eq("delivery_id", id);
    await supabase.from("deliveries").update({ status: "pending" }).eq("id", id);
    const { error } = await supabase.from("deliveries").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Delivery deleted");
      fetchData();
    }
    setDeleteTarget(null);
    setDeleting(false);
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    let failed = 0;
    for (const id of ids) {
      await supabase.from("packing_slips").delete().eq("delivery_id", id);
      await supabase.from("delivery_stops").delete().eq("delivery_id", id);
      await supabase.from("deliveries").update({ status: "pending" }).eq("id", id);
      const { error } = await supabase.from("deliveries").delete().eq("id", id);
      if (error) failed++;
    }
    if (failed > 0) {
      toast.error(`Failed to delete ${failed} delivery(ies)`);
    } else {
      toast.success(`Deleted ${ids.length} delivery(ies)`);
    }
    clearSelection();
    setShowBulkDeleteConfirm(false);
    setBulkDeleting(false);
    fetchData();
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-background overflow-hidden">
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-destructive/10 blur-[160px]" />
      </div>

      <header className="relative z-10 flex items-center gap-3 px-4 py-5">
        <Link to="/shop-floor" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-black tracking-wider text-foreground uppercase">Delivery Ops</h1>
          <p className="text-[10px] tracking-[0.3em] text-primary/70 uppercase">Active Dispatches</p>
        </div>
        {cards.length > 0 && (
          <button
            onClick={toggleSelectAll}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all",
              allSelected
                ? "bg-primary/20 text-primary border border-primary/40"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
            )}
          >
            <CheckSquare className="w-4 h-4" />
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        )}
      </header>

      <div className="relative z-10 flex-1 px-4 pb-20 space-y-6">
        <ReadyToShipBoard />
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Truck className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground tracking-wider uppercase">No active deliveries</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map((card) => {
              const canSchedule = card.status === "staged" || card.status === "pending";
              const isSelected = selectedIds.has(card.id);
              const inner = (
                <div className={cn(
                  "group relative flex flex-col gap-3 p-5 rounded-xl border bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-200 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]",
                  isSelected
                    ? "border-primary/60 ring-1 ring-primary/30"
                    : "border-border/60 hover:border-primary/40"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(card.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="data-[state=checked]:bg-primary"
                      />
                      <span className={cn("px-2.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase", STATUS_COLORS[card.status] || STATUS_COLORS.pending)}>
                        {STATUS_LABELS[card.status] || card.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {card.order_number && (
                        <span className="text-[10px] text-muted-foreground font-mono">{card.order_number}</span>
                      )}
                      <button
                        className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteTarget(card);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-black tracking-wide text-foreground uppercase leading-tight">
                    {card.customer_name}
                  </h3>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Package className="w-3.5 h-3.5" />
                    <span className="text-xs tracking-wider uppercase">{card.bundle_summary}</span>
                  </div>

                  {card.driver_name && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="w-3 h-3" /> {card.driver_name}
                      {card.vehicle && <><Car className="w-3 h-3 ml-2" /> {card.vehicle}</>}
                    </div>
                  )}

                  {card.due_date && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                      <Calendar className="w-3 h-3" /> Due: {card.due_date}
                    </div>
                  )}

                  {card.site_address && (
                    <p className="text-[11px] text-muted-foreground/70 truncate">{card.site_address}</p>
                  )}

                  {canSchedule && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 text-xs"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setScheduleTarget(card);
                        setSchedForm({
                          driver_name: card.driver_name || "",
                          vehicle: card.vehicle || "",
                          scheduled_date: card.scheduled_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                        });
                      }}
                    >
                      Schedule Dispatch
                    </Button>
                  )}
                </div>
              );

              return card.stop_id ? (
                <Link key={card.id} to={`/shopfloor/delivery/${card.stop_id}`}>
                  {inner}
                </Link>
              ) : (
                <div key={card.id}>{inner}</div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {someSelected && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-popover border border-border shadow-lg rounded-lg px-4 py-2.5"
          >
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setShowBulkDeleteConfirm(true)}
              disabled={bulkDeleting}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={clearSelection}
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule Dialog */}
      <Dialog open={!!scheduleTarget} onOpenChange={(o) => !o && setScheduleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Delivery</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Driver Name</Label>
              <Input value={schedForm.driver_name} onChange={(e) => setSchedForm((f) => ({ ...f, driver_name: e.target.value }))} />
            </div>
            <div>
              <Label>Vehicle</Label>
              <Input value={schedForm.vehicle} onChange={(e) => setSchedForm((f) => ({ ...f, vehicle: e.target.value }))} />
            </div>
            <div>
              <Label>Scheduled Date</Label>
              <Input type="date" value={schedForm.scheduled_date} onChange={(e) => setSchedForm((f) => ({ ...f, scheduled_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleTarget(null)}>Cancel</Button>
            <Button onClick={handleSchedule} disabled={saving}>{saving ? "Saving…" : "Schedule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation (single) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Delivery</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.delivery_number}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={(o) => !o && setShowBulkDeleteConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Deliveries</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} selected delivery(ies)? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? "Deleting…" : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
