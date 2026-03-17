import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Send, CheckCircle, XCircle, Ban } from "lucide-react";
import { SalesInvoice } from "@/hooks/useSalesInvoices";
import { useState, useEffect } from "react";
import { format, isPast } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { toast } from "sonner";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  sort_order: number;
}

interface Props {
  invoice: SalesInvoice | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (data: Partial<SalesInvoice> & { id: string }) => void;
  onDelete: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const TRANSITIONS: Record<string, { label: string; to: string; icon: any; variant?: any }[]> = {
  draft: [{ label: "Mark Sent", to: "sent", icon: Send }],
  sent: [
    { label: "Mark Paid", to: "paid", icon: CheckCircle },
    { label: "Cancel", to: "cancelled", icon: Ban, variant: "destructive" },
  ],
  paid: [],
  overdue: [
    { label: "Mark Paid", to: "paid", icon: CheckCircle },
    { label: "Cancel", to: "cancelled", icon: Ban, variant: "destructive" },
  ],
  cancelled: [],
};

export default function SalesInvoiceDrawer({ invoice, open, onClose, onUpdate, onDelete }: Props) {
  const { companyId } = useCompanyId();
  const [items, setItems] = useState<LineItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (invoice) {
      setNotes(invoice.notes || "");
      loadItems(invoice.id);
    }
  }, [invoice?.id]);

  const loadItems = async (invId: string) => {
    setLoadingItems(true);
    const { data } = await supabase
      .from("sales_invoice_items" as any)
      .select("*")
      .eq("invoice_id", invId)
      .order("sort_order");
    setItems((data as any[] || []).map((d: any) => d));
    setLoadingItems(false);
  };

  const addItem = async () => {
    if (!invoice || !companyId) return;
    const { data, error } = await supabase
      .from("sales_invoice_items" as any)
      .insert({ invoice_id: invoice.id, company_id: companyId, description: "", quantity: 1, unit: "ea", unit_price: 0, sort_order: items.length } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setItems(prev => [...prev, data as any]);
  };

  const updateItem = async (id: string, field: string, value: any) => {
    await supabase.from("sales_invoice_items" as any).update({ [field]: value } as any).eq("id", id);
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  const removeItem = async (id: string) => {
    await supabase.from("sales_invoice_items" as any).delete().eq("id", id);
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const itemsTotal = items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);

  if (!invoice) return null;

  const isOverdue = invoice.status === "sent" && invoice.due_date && isPast(new Date(invoice.due_date));
  const displayStatus = isOverdue ? "overdue" : invoice.status;
  const transitions = TRANSITIONS[displayStatus] || TRANSITIONS[invoice.status] || [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="text-left font-mono">{invoice.invoice_number}</SheetTitle>
            <Badge className={STATUS_COLORS[displayStatus] || ""}>{displayStatus}</Badge>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Status transitions */}
          {transitions.length > 0 && (
            <div className="flex gap-2">
              {transitions.map(t => (
                <Button
                  key={t.to}
                  size="sm"
                  variant={t.variant || "default"}
                  onClick={() => {
                    const updates: any = { id: invoice.id, status: t.to };
                    if (t.to === "paid") updates.paid_date = new Date().toISOString().split("T")[0];
                    onUpdate(updates);
                  }}
                >
                  <t.icon className="w-3.5 h-3.5 mr-1" />{t.label}
                </Button>
              ))}
            </div>
          )}

          {/* Customer info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Customer Name</Label>
              <Input defaultValue={invoice.customer_name || ""} className="h-9" onBlur={(e) => onUpdate({ id: invoice.id, customer_name: e.target.value || null })} />
            </div>
            <div>
              <Label className="text-xs">Company</Label>
              <Input defaultValue={invoice.customer_company || ""} className="h-9" onBlur={(e) => onUpdate({ id: invoice.id, customer_company: e.target.value || null })} />
            </div>
          </div>

          {/* Dates + Amount */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Issued</Label>
              <Input type="date" defaultValue={invoice.issued_date || ""} className="h-9" onBlur={(e) => onUpdate({ id: invoice.id, issued_date: e.target.value || null })} />
            </div>
            <div>
              <Label className="text-xs">Due</Label>
              <Input type="date" defaultValue={invoice.due_date || ""} className="h-9" onBlur={(e) => onUpdate({ id: invoice.id, due_date: e.target.value || null })} />
            </div>
            <div>
              <Label className="text-xs">Total</Label>
              <p className="text-lg font-bold text-primary mt-1">$ {(invoice.amount || itemsTotal).toLocaleString()}</p>
            </div>
          </div>

          {/* Payment info */}
          {invoice.status === "paid" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Paid Date</Label>
                <Input type="date" defaultValue={(invoice as any).paid_date || ""} className="h-9" onBlur={(e) => onUpdate({ id: invoice.id, paid_date: e.target.value || null } as any)} />
              </div>
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Input defaultValue={(invoice as any).payment_method || ""} className="h-9" placeholder="e.g. Check, Wire" onBlur={(e) => onUpdate({ id: invoice.id, payment_method: e.target.value || null } as any)} />
              </div>
            </div>
          )}

          {/* Line Items */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Line Items</p>
              <Button size="sm" variant="ghost" onClick={addItem} className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" />Add</Button>
            </div>
            {loadingItems ? (
              <p className="text-xs text-muted-foreground animate-pulse">Loading...</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 py-4 text-center">No line items</p>
            ) : (
              <div className="space-y-1.5">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_60px_60px_70px_28px] gap-1.5 items-center">
                    <Input defaultValue={item.description} placeholder="Description" className="h-7 text-xs" onBlur={(e) => updateItem(item.id, "description", e.target.value)} />
                    <Input type="number" defaultValue={item.quantity} className="h-7 text-xs text-center" onBlur={(e) => updateItem(item.id, "quantity", Number(e.target.value) || 0)} />
                    <Input type="number" defaultValue={item.unit_price} className="h-7 text-xs text-right" onBlur={(e) => updateItem(item.id, "unit_price", Number(e.target.value) || 0)} />
                    <span className="text-xs text-right font-medium">$ {(item.quantity * item.unit_price).toLocaleString()}</span>
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
                <div className="flex justify-end pt-1 border-t border-border/50">
                  <span className="text-sm font-bold">Total: $ {itemsTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="border-t border-border pt-3">
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => { if (notes !== (invoice.notes || "")) onUpdate({ id: invoice.id, notes: notes || null }); }} rows={3} className="mt-1" />
          </div>

          {/* Actions */}
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <div className="text-[10px] text-muted-foreground">
              Created: {format(new Date(invoice.created_at), "MMM d, yyyy")}
            </div>
            <Button variant="destructive" size="sm" onClick={() => { onDelete(invoice.id); onClose(); }}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
