import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Copy, Send, CheckCircle, XCircle } from "lucide-react";
import { SalesQuotation } from "@/hooks/useSalesQuotations";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  sort_order: number;
}

interface Props {
  quotation: SalesQuotation | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (data: Partial<SalesQuotation> & { id: string }) => void;
  onDelete: (id: string) => void;
  onDuplicate: (q: SalesQuotation) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  declined: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  expired: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

const TRANSITIONS: Record<string, { label: string; to: string; icon: any; variant?: any }[]> = {
  draft: [{ label: "Mark Sent", to: "sent", icon: Send, variant: "default" }],
  sent: [
    { label: "Accepted", to: "accepted", icon: CheckCircle, variant: "default" },
    { label: "Declined", to: "declined", icon: XCircle, variant: "destructive" },
  ],
  accepted: [],
  declined: [],
  expired: [],
};

export default function SalesQuotationDrawer({ quotation, open, onClose, onUpdate, onDelete, onDuplicate }: Props) {
  const { companyId } = useCompanyId();
  const qc = useQueryClient();
  const [items, setItems] = useState<LineItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (quotation) {
      setNotes(quotation.notes || "");
      loadItems(quotation.id);
    }
  }, [quotation?.id]);

  const loadItems = async (qId: string) => {
    setLoadingItems(true);
    const { data } = await supabase
      .from("sales_quotation_items" as any)
      .select("*")
      .eq("quotation_id", qId)
      .order("sort_order");
    setItems((data as any[] || []).map((d: any) => ({ ...d, total: d.quantity * d.unit_price })));
    setLoadingItems(false);
  };

  const addItem = async () => {
    if (!quotation || !companyId) return;
    const { data, error } = await supabase
      .from("sales_quotation_items" as any)
      .insert({ quotation_id: quotation.id, company_id: companyId, description: "", quantity: 1, unit: "ea", unit_price: 0, sort_order: items.length } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setItems(prev => [...prev, { ...(data as any), total: 0 }]);
  };

  const updateItem = async (id: string, field: string, value: any) => {
    await supabase.from("sales_quotation_items" as any).update({ [field]: value } as any).eq("id", id);
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value, total: field === "quantity" ? value * it.unit_price : field === "unit_price" ? it.quantity * value : it.total } : it));
  };

  const removeItem = async (id: string) => {
    await supabase.from("sales_quotation_items" as any).delete().eq("id", id);
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const itemsTotal = items.reduce((s, it) => s + (it.quantity * it.unit_price), 0);

  if (!quotation) return null;

  const transitions = TRANSITIONS[quotation.status] || [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="text-left font-mono">{quotation.quotation_number}</SheetTitle>
            <Badge className={STATUS_COLORS[quotation.status] || ""}>{quotation.status}</Badge>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Status transitions */}
          {transitions.length > 0 && (
            <div className="flex gap-2">
              {transitions.map(t => (
                <Button key={t.to} size="sm" variant={t.variant || "default"} onClick={() => onUpdate({ id: quotation.id, status: t.to })}>
                  <t.icon className="w-3.5 h-3.5 mr-1" />{t.label}
                </Button>
              ))}
            </div>
          )}

          {/* Customer info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Customer Name</Label>
              <Input
                defaultValue={quotation.customer_name || ""}
                className="h-9"
                onBlur={(e) => onUpdate({ id: quotation.id, customer_name: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-xs">Company</Label>
              <Input
                defaultValue={quotation.customer_company || ""}
                className="h-9"
                onBlur={(e) => onUpdate({ id: quotation.id, customer_company: e.target.value || null })}
              />
            </div>
          </div>

          {/* Expiry + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Expiry Date</Label>
              <Input
                type="date"
                defaultValue={quotation.expiry_date || ""}
                className="h-9"
                onBlur={(e) => onUpdate({ id: quotation.id, expiry_date: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="text-xs">Total Amount</Label>
              <p className="text-lg font-bold text-primary mt-1">$ {(quotation.amount || itemsTotal).toLocaleString()}</p>
            </div>
          </div>

          {/* Line Items */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Line Items</p>
              <Button size="sm" variant="ghost" onClick={addItem} className="h-7 text-xs">
                <Plus className="w-3 h-3 mr-1" />Add Item
              </Button>
            </div>
            {loadingItems ? (
              <p className="text-xs text-muted-foreground animate-pulse">Loading...</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 py-4 text-center">No line items — click Add Item</p>
            ) : (
              <div className="space-y-1.5">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_60px_60px_70px_28px] gap-1.5 items-center">
                    <Input
                      defaultValue={item.description}
                      placeholder="Description"
                      className="h-7 text-xs"
                      onBlur={(e) => updateItem(item.id, "description", e.target.value)}
                    />
                    <Input
                      type="number"
                      defaultValue={item.quantity}
                      className="h-7 text-xs text-center"
                      onBlur={(e) => updateItem(item.id, "quantity", Number(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      defaultValue={item.unit_price}
                      className="h-7 text-xs text-right"
                      onBlur={(e) => updateItem(item.id, "unit_price", Number(e.target.value) || 0)}
                    />
                    <span className="text-xs text-right font-medium">$ {(item.quantity * item.unit_price).toLocaleString()}</span>
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
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
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => { if (notes !== (quotation.notes || "")) onUpdate({ id: quotation.id, notes: notes || null }); }}
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { onDuplicate(quotation); onClose(); }}>
                <Copy className="w-3.5 h-3.5 mr-1" />Duplicate
              </Button>
            </div>
            <Button variant="destructive" size="sm" onClick={() => { onDelete(quotation.id); onClose(); }}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
            </Button>
          </div>

          <div className="text-[10px] text-muted-foreground">
            Created: {format(new Date(quotation.created_at), "MMM d, yyyy h:mm a")}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
