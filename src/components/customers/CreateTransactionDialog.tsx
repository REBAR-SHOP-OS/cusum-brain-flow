import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Loader2, ChevronDown } from "lucide-react";

export type TransactionType =
  | "Invoice"
  | "Estimate"
  | "Payment"
  | "SalesReceipt"
  | "CreditMemo";

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  serviceDate?: string;
}

interface CreateTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: TransactionType;
  customerQbId: string;
  customerName: string;
  prefill?: {
    lineItems?: LineItem[];
    memo?: string;
    amount?: number;
  };
  onCreated?: (payload: {
    type: TransactionType;
    lineItems: LineItem[];
    memo: string;
    totalAmount: number;
  }) => void;
}

const ACTION_MAP: Record<TransactionType, string> = {
  Invoice: "create-invoice",
  Estimate: "create-estimate",
  Payment: "create-payment",
  SalesReceipt: "create-invoice",
  CreditMemo: "create-creditmemo",
};

const LABELS: Record<TransactionType, string> = {
  Invoice: "Invoice",
  Estimate: "Estimate / Quotation",
  Payment: "Payment",
  SalesReceipt: "Sales Receipt",
  CreditMemo: "Credit Memo",
};

const TERMS_OPTIONS = ["Net 15", "Net 30", "Net 60", "Due on receipt"];

const needsLineItems = (t: TransactionType) =>
  t !== "Payment";

const showDetails = (t: TransactionType) =>
  t === "Invoice" || t === "Estimate";

export function CreateTransactionDialog({
  open,
  onOpenChange,
  type,
  customerQbId,
  customerName,
  prefill,
  onCreated,
}: CreateTransactionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();

  const [lineItems, setLineItems] = useState<LineItem[]>(
    prefill?.lineItems ?? [{ description: "", qty: 1, unitPrice: 0 }]
  );
  const [memo, setMemo] = useState(prefill?.memo ?? "");
  const [dueDate, setDueDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number>(prefill?.amount ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(13);

  // Additional detail fields (Invoice/Estimate parity with InvoiceEditor)
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [billAddr, setBillAddr] = useState("");
  const [shipAddr, setShipAddr] = useState("");
  const [termsValue, setTermsValue] = useState("");
  const [shipVia, setShipVia] = useState("");
  const [shipDate, setShipDate] = useState("");
  const [trackingNum, setTrackingNum] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [salesRep, setSalesRep] = useState("");

  // Fetch QB items for product picker
  const { data: qbItems } = useQuery({
    queryKey: ["qb_items_for_picker", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("accounting_mirror")
        .select("quickbooks_id, data")
        .eq("company_id", companyId)
        .eq("entity_type", "Item");
      if (error) throw error;
      return (data || [])
        .map((row) => {
          const d = row.data as Record<string, unknown>;
          return {
            id: row.quickbooks_id,
            name: (d.Name as string) || "",
            description: (d.Description as string) || "",
            unitPrice: (d.UnitPrice as number) || 0,
            type: (d.Type as string) || "",
            active: d.Active !== false,
          };
        })
        .filter((i) => i.active && i.type !== "Category");
    },
    enabled: !!companyId && open,
    staleTime: 5 * 60 * 1000,
  });

  const activeProducts = useMemo(() => qbItems || [], [qbItems]);

  const total = lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0);
  const safeTaxRate = Math.max(0, Math.min(100, taxRate));
  const taxAmount = needsLineItems(type) && taxEnabled ? total * (safeTaxRate / 100) : 0;
  const grandTotal = total + taxAmount;

  const addLine = () =>
    setLineItems((prev) => [...prev, { description: "", qty: 1, unitPrice: 0 }]);

  const removeLine = (idx: number) =>
    setLineItems((prev) => prev.filter((_, i) => i !== idx));

  const updateLine = (idx: number, field: keyof LineItem, value: string | number) =>
    setLineItems((prev) =>
      prev.map((li, i) => (i === idx ? { ...li, [field]: value } : li))
    );

  const selectProduct = (idx: number, productId: string) => {
    const product = activeProducts.find((p) => p.id === productId);
    if (!product) return;
    setLineItems((prev) =>
      prev.map((li, i) =>
        i === idx
          ? { ...li, description: product.description || product.name, unitPrice: product.unitPrice }
          : li
      )
    );
  };

  const handleSubmit = async () => {
    if (needsLineItems(type) && lineItems.every((li) => !li.description.trim())) {
      toast({ title: "Add at least one line item", variant: "destructive" });
      return;
    }
    if (type === "Payment" && paymentAmount <= 0) {
      toast({ title: "Enter a payment amount", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const action = ACTION_MAP[type];
      const body: Record<string, any> = {
        action,
        customerId: customerQbId,
        customerName,
        memo,
      };

      if (needsLineItems(type)) {
        body.lineItems = lineItems
          .filter((li) => li.description.trim())
          .map((li) => ({
            description: li.description,
            quantity: li.qty,
            unitPrice: li.unitPrice,
            amount: li.qty * li.unitPrice,
            ...(li.serviceDate ? { serviceDate: li.serviceDate } : {}),
          }));
      }

      if (type === "Payment") {
        body.totalAmount = paymentAmount;
      }
      if (needsLineItems(type) && taxEnabled && safeTaxRate > 0) {
        body.taxRate = safeTaxRate / 100;
        body.taxAmount = taxAmount;
      }
      if (dueDate) {
        body.dueDate = dueDate;
      }

      // Sparse additional detail fields
      if (billAddr) body.billAddr = billAddr;
      if (shipAddr) body.shipAddr = shipAddr;
      if (termsValue) body.terms = termsValue;
      if (shipVia) body.shipVia = shipVia;
      if (shipDate) body.shipDate = shipDate;
      if (trackingNum) body.trackingNum = trackingNum;

      const customFields: Array<{ Name: string; StringValue: string; Type: string }> = [];
      if (poNumber) customFields.push({ Name: "P.O. Number", StringValue: poNumber, Type: "StringType" });
      if (salesRep) customFields.push({ Name: "Sales Rep", StringValue: salesRep, Type: "StringType" });
      if (customFields.length) body.customFields = customFields;

      const { data, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: `${LABELS[type]} created successfully` });
      queryClient.invalidateQueries({ queryKey: ["qb_customer_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["quickbooks-data"] });
      queryClient.invalidateQueries({ queryKey: ["qb_transactions"] });

      onCreated?.({
        type,
        lineItems: needsLineItems(type) ? lineItems.filter((li) => li.description.trim()) : [],
        memo,
        totalAmount: type === "Payment" ? paymentAmount : grandTotal,
      });

      onOpenChange(false);
      // Reset all fields
      setLineItems([{ description: "", qty: 1, unitPrice: 0 }]);
      setMemo("");
      setDueDate("");
      setPaymentAmount(0);
      setTaxEnabled(true);
      setTaxRate(13);
      setBillAddr("");
      setShipAddr("");
      setTermsValue("");
      setShipVia("");
      setShipDate("");
      setTrackingNum("");
      setPoNumber("");
      setSalesRep("");
      setDetailsOpen(false);
    } catch (err: any) {
      toast({
        title: "Failed to create transaction",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const hasProducts = activeProducts.length > 0;
  // Column layout: Product?(140) | Desc(1fr) | SvcDate(100) | Qty(80) | UnitPrice(100) | Amount(90) | Del(36)
  const gridCols = hasProducts
    ? "grid-cols-[140px_1fr_100px_80px_100px_90px_36px]"
    : "grid-cols-[1fr_100px_80px_100px_90px_36px]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create {LABELS[type]}</DialogTitle>
          <DialogDescription>
            For customer: <span className="font-medium text-foreground">{customerName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {type === "Payment" && (
            <div className="space-y-1.5">
              <Label>Payment Amount ($)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={paymentAmount || ""}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                placeholder="0.00"
              />
            </div>
          )}

          {(type === "Invoice" || type === "Estimate") && (
            <div className="space-y-1.5">
              <Label>{type === "Estimate" ? "Expiration Date" : "Due Date"}</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          )}

          {/* Additional Details — collapsible, Invoice/Estimate only */}
          {showDetails(type) && (
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs px-1 -ml-1 text-muted-foreground hover:text-foreground">
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", detailsOpen && "rotate-180")} />
                  Additional Details
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="grid grid-cols-2 gap-3 border border-border rounded-lg p-3 bg-muted/30">
                  <div className="space-y-1">
                    <Label className="text-xs">Billing Address</Label>
                    <Textarea
                      value={billAddr}
                      onChange={(e) => setBillAddr(e.target.value)}
                      rows={2}
                      className="text-xs min-h-[52px]"
                      placeholder="Billing address…"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Shipping Address</Label>
                    <Textarea
                      value={shipAddr}
                      onChange={(e) => setShipAddr(e.target.value)}
                      rows={2}
                      className="text-xs min-h-[52px]"
                      placeholder="Shipping address…"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Terms</Label>
                    <Select value={termsValue} onValueChange={setTermsValue}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select terms…" />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMS_OPTIONS.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ship Via</Label>
                    <Input className="h-8 text-xs" value={shipVia} onChange={(e) => setShipVia(e.target.value)} placeholder="e.g. FedEx" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ship Date</Label>
                    <Input className="h-8 text-xs" type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tracking No.</Label>
                    <Input className="h-8 text-xs" value={trackingNum} onChange={(e) => setTrackingNum(e.target.value)} placeholder="Tracking number" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">P.O. Number</Label>
                    <Input className="h-8 text-xs" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="Purchase order #" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sales Rep</Label>
                    <Input className="h-8 text-xs" value={salesRep} onChange={(e) => setSalesRep(e.target.value)} placeholder="Sales representative" />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {needsLineItems(type) && (
            <div className="space-y-2">
              <Label>Line Items</Label>
              <div className="border border-border rounded-lg overflow-hidden">
                {/* Header */}
                <div className={cn("grid gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground", gridCols)}>
                  {hasProducts && <span>Product/Service</span>}
                  <span>Description</span>
                  <span>Svc Date</span>
                  <span>Qty</span>
                  <span>Unit Price</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>
                {/* Rows */}
                {lineItems.map((li, idx) => (
                  <div
                    key={idx}
                    className={cn("grid gap-2 px-3 py-1.5 border-t border-border items-center", gridCols)}
                  >
                    {hasProducts && (
                      <Select onValueChange={(val) => selectProduct(idx, val)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {activeProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      className="h-8 text-sm"
                      placeholder="Description"
                      value={li.description}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
                    />
                    <Input
                      className="h-8 text-xs"
                      type="date"
                      value={li.serviceDate || ""}
                      onChange={(e) => updateLine(idx, "serviceDate", e.target.value)}
                    />
                    <Input
                      className="h-8 text-sm"
                      type="number"
                      min={1}
                      value={li.qty}
                      onChange={(e) => updateLine(idx, "qty", Number(e.target.value))}
                    />
                    <Input
                      className="h-8 text-sm"
                      type="number"
                      min={0}
                      step={0.01}
                      value={li.unitPrice || ""}
                      onChange={(e) =>
                        updateLine(idx, "unitPrice", Number(e.target.value))
                      }
                    />
                    <span className="text-sm text-right font-medium">
                      ${(li.qty * li.unitPrice).toFixed(2)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeLine(idx)}
                      disabled={lineItems.length <= 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
                  <Button type="button" variant="ghost" size="sm" onClick={addLine} className="gap-1 text-xs">
                    <Plus className="w-3 h-3" /> Add line
                  </Button>
                  <span className="text-sm text-muted-foreground">Subtotal: ${total.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={taxEnabled}
                      onChange={(e) => setTaxEnabled(e.target.checked)}
                      className="rounded border-input"
                    />
                    <span className="font-medium">HST (ON)</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={taxRate}
                      onChange={(e) => setTaxRate(Math.max(0, Math.min(100, Number(e.target.value))))}
                      className="h-6 w-16 text-xs text-center"
                      disabled={!taxEnabled}
                    />
                    <span className="text-muted-foreground">%</span>
                  </label>
                  <span className="text-sm tabular-nums">${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-end px-3 py-2 border-t border-border bg-muted/50">
                  <span className="text-sm font-semibold">Grand Total: ${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Memo / Notes</Label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
              placeholder="Optional memo..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Create {LABELS[type]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
