import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Send, AlertTriangle, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Order, OrderItem } from "@/hooks/useOrders";
import { useOrders, ALLOWED_TRANSITIONS } from "@/hooks/useOrders";
import { ShopDrawingStepper } from "./ShopDrawingStepper";
import { QCChecklist } from "./QCChecklist";
import { ProductionLockBanner } from "./ProductionLockBanner";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const STATUSES = ["pending", "confirmed", "in_production", "invoiced", "partially_paid", "paid", "closed", "cancelled"];

interface Props {
  order: Order;
  onBack: () => void;
}

export function OrderDetail({ order, onBack }: Props) {
  const { toast } = useToast();
  const { useOrderItems, addItem, updateItem, deleteItem, updateOrderStatus, updateOrderFields, sendToQuickBooks } = useOrders();
  const { data: items = [], isLoading: itemsLoading } = useOrderItems(order.id);
  const [sending, setSending] = useState(false);
  const [newItem, setNewItem] = useState({ description: "", quantity: "1", unit_price: "0" });

  const handleAddItem = () => {
    if (!newItem.description.trim()) return;
    addItem.mutate({
      order_id: order.id,
      description: newItem.description,
      quantity: Number(newItem.quantity) || 1,
      unit_price: Number(newItem.unit_price) || 0,
    });
    setNewItem({ description: "", quantity: "1", unit_price: "0" });
  };

  const handleSendToQB = async () => {
    setSending(true);
    try {
      await sendToQuickBooks(order.id);
    } catch (err) {
      toast({
        title: "Failed to create QB invoice",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleShopDrawingChange = (status: string) => {
    const updates: Record<string, unknown> = { id: order.id, shop_drawing_status: status };
    if (status === "approved") {
      updates.customer_approved_at = new Date().toISOString();
      updates.production_locked = false;
    }
    updateOrderFields.mutate(updates as any);
  };

  const handleQCToggle = (field: string, checked: boolean) => {
    const updates: Record<string, unknown> = { id: order.id };
    if (field === "qc_internal_approved_at") {
      updates[field] = checked ? new Date().toISOString() : null;
    } else if (field === "customer_approved_at") {
      updates[field] = checked ? new Date().toISOString() : null;
    } else {
      updates[field] = checked;
    }
    // Auto-unlock production when all gates pass
    if (field === "qc_internal_approved_at" && checked && order.shop_drawing_status === "approved" && !order.pending_change_order) {
      updates.production_locked = false;
    }
    updateOrderFields.mutate(updates as any);
  };

  const handleRevisionIncrement = () => {
    updateOrderFields.mutate({
      id: order.id,
      customer_revision_count: order.customer_revision_count + 1,
      shop_drawing_status: "customer_revision",
    } as any);
  };

  const hasQBId = !!order.customers?.quickbooks_id;
  const isInvoiced = order.status === "invoiced" || order.status === "paid" || order.status === "partially_paid";
  const itemsTotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);

  const qcGates = [
    { label: "QC Internal Approval", checked: !!order.qc_internal_approved_at, timestamp: order.qc_internal_approved_at, field: "qc_internal_approved_at" },
    { label: "Customer Approval", checked: !!order.customer_approved_at, timestamp: order.customer_approved_at, field: "customer_approved_at" },
    { label: "QC Evidence Uploaded", checked: order.qc_evidence_uploaded, timestamp: null, field: "qc_evidence_uploaded" },
    { label: "QC Final Approved", checked: order.qc_final_approved, timestamp: null, field: "qc_final_approved" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{order.order_number}</h2>
          <p className="text-sm text-muted-foreground">
            {order.customers?.name || "Unknown customer"}
            {order.quotes && <span className="ml-2">← Quote {order.quotes.quote_number}</span>}
          </p>
        </div>
        <Select
          value={order.status || "pending"}
          onValueChange={(v) => updateOrderStatus.mutate({ id: order.id, status: v, currentStatus: order.status || "pending" })}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(() => {
              const current = order.status || "pending";
              const allowed = ALLOWED_TRANSITIONS[current] || [];
              const visible = [current, ...allowed];
              return visible.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ));
            })()}
          </SelectContent>
        </Select>
      </div>

      {/* QB warning */}
      {!hasQBId && (
        <Card className="border-amber-300 bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <span>Customer <strong>{order.customers?.name}</strong> has no QuickBooks ID. Link it in QuickBooks before sending an invoice.</span>
          </CardContent>
        </Card>
      )}

      {/* Production Lock & Shop Drawing Status */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <ProductionLockBanner
            productionLocked={order.production_locked}
            pendingChangeOrder={order.pending_change_order}
            shopDrawingStatus={order.shop_drawing_status}
            qcInternalApproved={!!order.qc_internal_approved_at}
            revisionCount={order.customer_revision_count}
            billableRequired={order.billable_revision_required}
          />
          <ShopDrawingStepper
            status={order.shop_drawing_status}
            onStatusChange={handleShopDrawingChange}
          />
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={handleRevisionIncrement}
            >
              + Add Revision
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* QC Checklist */}
      <Card>
        <CardContent className="p-4">
          <QCChecklist gates={qcGates} onToggle={handleQCToggle} />
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            Line Items
            <span className="text-base font-bold">{fmt(itemsTotal)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {itemsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {items.map((item) => (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    orderId={order.id}
                    onUpdate={(updates) => updateItem.mutate({ id: item.id, orderId: order.id, ...updates })}
                    onDelete={() => deleteItem.mutate({ id: item.id, orderId: order.id })}
                  />
                ))}
              </div>

              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No line items yet. Add one below.</p>
              )}

              <div className="flex gap-2 pt-2 border-t border-border">
                <Input
                  placeholder="Description"
                  value={newItem.description}
                  onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
                  className="flex-1 h-8 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                />
                <Input
                  type="number"
                  placeholder="Qty"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem((p) => ({ ...p, quantity: e.target.value }))}
                  className="w-20 h-8 text-sm"
                />
                <Input
                  type="number"
                  placeholder="Unit $"
                  value={newItem.unit_price}
                  onChange={(e) => setNewItem((p) => ({ ...p, unit_price: e.target.value }))}
                  className="w-24 h-8 text-sm"
                />
                <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleAddItem} disabled={addItem.isPending}>
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        {!isInvoiced && (
          <Button
            onClick={handleSendToQB}
            disabled={sending || !hasQBId || items.length === 0 || itemsTotal === 0}
            className="gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send to QuickBooks
          </Button>
        )}
        {order.quickbooks_invoice_id && (
          <Badge variant="outline" className="text-sm px-3 py-1.5 bg-emerald-500/10 text-emerald-600">
            QB Invoice #{order.quickbooks_invoice_id}
          </Badge>
        )}
      </div>
    </div>
  );
}

function LineItemRow({
  item,
  orderId,
  onUpdate,
  onDelete,
}: {
  item: OrderItem;
  orderId: string;
  onUpdate: (updates: Partial<OrderItem>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(item.description);
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.unit_price));

  const save = () => {
    onUpdate({
      description: desc,
      quantity: Number(qty) || 1,
      unit_price: Number(price) || 0,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex gap-2 py-2 items-center">
        <Input value={desc} onChange={(e) => setDesc(e.target.value)} className="flex-1 h-8 text-sm" />
        <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-20 h-8 text-sm" />
        <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-24 h-8 text-sm" />
        <Button size="sm" variant="default" className="h-8 text-xs" onClick={save}>Save</Button>
        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{item.description}</p>
        {(item.bar_size || item.shape) && (
          <p className="text-xs text-muted-foreground">
            {item.bar_size && `${item.bar_size}`}
            {item.shape && ` · ${item.shape}`}
            {item.length_mm && ` · ${item.length_mm}mm`}
          </p>
        )}
      </div>
      <span className="text-xs text-muted-foreground w-16 text-right">{item.quantity} ×</span>
      <span className="text-xs w-20 text-right">{fmt(item.unit_price)}</span>
      <span className="text-sm font-semibold w-24 text-right">{fmt(item.quantity * item.unit_price)}</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(true)}>✏️</Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
}
