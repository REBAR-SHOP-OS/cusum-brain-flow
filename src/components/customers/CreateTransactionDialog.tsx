import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { Plus, Trash2, Loader2 } from "lucide-react";

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
}

interface CreateTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: TransactionType;
  customerQbId: string;
  customerName: string;
  /** Pre-fill from pattern */
  prefill?: {
    lineItems?: LineItem[];
    memo?: string;
    amount?: number;
  };
  /** Called after successful creation so pattern can be recorded */
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

const needsLineItems = (t: TransactionType) =>
  t !== "Payment";

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
      // Reset
      setLineItems([{ description: "", qty: 1, unitPrice: 0 }]);
      setMemo("");
      setDueDate("");
      setPaymentAmount(0);
      setTaxEnabled(true);
      setTaxRate(13);
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
          {/* Payment-specific: amount field */}
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

          {/* Due date for Invoice / Estimate */}
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

          {/* Line items */}
          {needsLineItems(type) && (
            <div className="space-y-2">
              <Label>Line Items</Label>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_80px_100px_90px_36px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Unit Price</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>
                {lineItems.map((li, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_80px_100px_90px_36px] gap-2 px-3 py-1.5 border-t border-border items-center"
                  >
                    <Input
                      className="h-8 text-sm"
                      placeholder="Description"
                      value={li.description}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
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

          {/* Memo */}
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
