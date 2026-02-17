import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Printer, Pencil, Save, Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import brandLogo from "@/assets/brand-logo.png";
import { Badge } from "@/components/ui/badge";
import type { QBInvoice, QBCustomer, QBItem, QBPayment } from "@/hooks/useQuickBooksData";

interface LineItem {
  Description: string;
  Amount: number;
  Qty: number;
  UnitPrice: number;
  ItemRef?: { value: string; name: string };
}

interface Props {
  invoice: QBInvoice;
  customers: QBCustomer[];
  items: QBItem[];
  payments: QBPayment[];
  onUpdate: (invoiceId: string, updates: Record<string, unknown>) => Promise<unknown>;
  onClose: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function parseLineItems(invoice: QBInvoice): LineItem[] {
  const raw = (invoice as unknown as Record<string, unknown>).Line as Array<Record<string, unknown>> | undefined;
  if (!raw) {
    return [{ Description: "Rebar Fabrication & Supply", Qty: 1, UnitPrice: invoice.TotalAmt, Amount: invoice.TotalAmt }];
  }
  return raw
    .filter((l) => l.DetailType === "SalesItemLineDetail")
    .map((l) => {
      const detail = l.SalesItemLineDetail as Record<string, unknown> | undefined;
      return {
        Description: (l.Description as string) || "",
        Amount: (l.Amount as number) || 0,
        Qty: (detail?.Qty as number) || 1,
        UnitPrice: (detail?.UnitPrice as number) || 0,
        ItemRef: detail?.ItemRef as { value: string; name: string } | undefined,
      };
    });
}

export function InvoiceEditor({ invoice, customers, items, payments, onUpdate, onClose }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [customerRef, setCustomerRef] = useState(invoice.CustomerRef);
  const [txnDate, setTxnDate] = useState(invoice.TxnDate?.split("T")[0] || "");
  const [dueDate, setDueDate] = useState(invoice.DueDate?.split("T")[0] || "");
  const [memo, setMemo] = useState(
    ((invoice as unknown as Record<string, unknown>).CustomerMemo as { value: string } | undefined)?.value || ""
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(() => parseLineItems(invoice));

  const subtotal = useMemo(() => lineItems.reduce((s, l) => s + l.Amount, 0), [lineItems]);
  const taxAmount = useMemo(() => {
    const raw = (invoice as unknown as Record<string, unknown>).TxnTaxDetail as Record<string, unknown> | undefined;
    return (raw?.TotalTax as number) || subtotal * 0.13;
  }, [invoice, subtotal]);
  const total = subtotal + taxAmount;
  const paid = invoice.TotalAmt - invoice.Balance;
  const amountDue = total - paid;

  // Extract payments linked to this invoice
  const linkedPayments = useMemo(() => {
    const results: { date: string; amount: number }[] = [];
    for (const pmt of payments) {
      const raw = pmt as unknown as Record<string, unknown>;
      const lines = raw.Line as Array<Record<string, unknown>> | undefined;
      if (!lines) continue;
      for (const line of lines) {
        const linkedTxns = line.LinkedTxn as Array<{ TxnId: string; TxnType: string }> | undefined;
        if (!linkedTxns) continue;
        for (const txn of linkedTxns) {
          if (txn.TxnType === "Invoice" && txn.TxnId === invoice.Id) {
            results.push({
              date: (raw.TxnDate as string) || "",
              amount: (line.Amount as number) || 0,
            });
          }
        }
      }
    }
    return results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [payments, invoice.Id]);

  const paymentStatus = invoice.Balance === 0 ? "PAID" : linkedPayments.length > 0 ? "PARTIAL" : "OPEN";

  const updateLineItem = (idx: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[idx] };
      if (field === "Qty" || field === "UnitPrice") {
        (item as Record<string, unknown>)[field] = Number(value) || 0;
        item.Amount = item.Qty * item.UnitPrice;
      } else {
        (item as Record<string, unknown>)[field] = value;
      }
      updated[idx] = item;
      return updated;
    });
  };

  const addLine = () => {
    setLineItems((prev) => [...prev, { Description: "", Qty: 1, UnitPrice: 0, Amount: 0 }]);
  };

  const removeLine = (idx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        CustomerRef: { value: customerRef.value, name: customerRef.name },
        TxnDate: txnDate,
        DueDate: dueDate,
        CustomerMemo: { value: memo },
        Line: [
          ...lineItems.map((l) => ({
            DetailType: "SalesItemLineDetail",
            Amount: l.Amount,
            Description: l.Description,
            SalesItemLineDetail: {
              Qty: l.Qty,
              UnitPrice: l.UnitPrice,
              ...(l.ItemRef ? { ItemRef: l.ItemRef } : {}),
            },
          })),
          // QB requires a SubTotalLine for sparse updates
          { DetailType: "SubTotalLineDetail", Amount: subtotal, SubTotalLineDetail: {} },
        ],
      };

      await onUpdate(invoice.Id, updates);
      setEditing(false);
    } catch (err) {
      toast({ title: "Update failed", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8">
      {/* Action bar */}
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
        {!editing ? (
          <>
            <Button size="sm" variant="default" className="gap-2" onClick={() => setEditing(true)}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
            <Button size="sm" onClick={handlePrint} className="gap-2" variant="outline">
              <Printer className="w-4 h-4" /> Print
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" className="gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="bg-white text-black w-[210mm] min-h-[297mm] p-10 shadow-2xl print:shadow-none print:p-8 print:w-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-3">
            <img src={brandLogo} alt="Rebar.Shop" className="w-12 h-12 rounded-full object-contain" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Rebar.Shop Inc</h1>
              <p className="text-xs text-gray-500">9 Cedar Ave, Thornhill L3T 3W1, Canada</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-black text-gray-900">Invoice #{invoice.DocNumber}</h2>
            {editing ? (
              <div className="mt-2 space-y-2 text-left">
                <label className="text-xs text-gray-500">Invoice Date</label>
                <Input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} className="h-8 text-sm bg-white border-gray-300" />
                <label className="text-xs text-gray-500">Due Date</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-sm bg-white border-gray-300" />
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mt-1">Invoice Date: {txnDate ? new Date(txnDate).toLocaleDateString() : "—"}</p>
                <p className="text-sm text-gray-500">Due Date: {dueDate ? new Date(dueDate).toLocaleDateString() : "—"}</p>
              </>
            )}
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Bill To</p>
          {editing ? (
            <Select
              value={customerRef.value}
              onValueChange={(val) => {
                const c = customers.find((c) => c.Id === val);
                if (c) setCustomerRef({ value: c.Id, name: c.DisplayName });
              }}
            >
              <SelectTrigger className="bg-white border-gray-300">
                <SelectValue placeholder={customerRef.name || "Select customer..."} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.Id} value={c.Id}>
                    {c.DisplayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-base font-semibold text-gray-900">{customerRef.name || "Unknown"}</p>
          )}
        </div>

        {/* Line Items */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 font-bold">Description</th>
              <th className="text-right py-2 font-bold w-20">Qty</th>
              <th className="text-right py-2 font-bold w-24">Unit Price</th>
              <th className="text-right py-2 font-bold w-28">Amount</th>
              {editing && <th className="w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((line, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                {editing ? (
                  <>
                    <td className="py-2 pr-2">
                      <Input
                        value={line.Description}
                        onChange={(e) => updateLineItem(idx, "Description", e.target.value)}
                        className="h-8 text-sm bg-white border-gray-300"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <Input
                        type="number"
                        value={line.Qty}
                        onChange={(e) => updateLineItem(idx, "Qty", e.target.value)}
                        className="h-8 text-sm text-right w-20 bg-white border-gray-300"
                      />
                    </td>
                    <td className="py-2 px-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={line.UnitPrice}
                        onChange={(e) => updateLineItem(idx, "UnitPrice", e.target.value)}
                        className="h-8 text-sm text-right w-24 bg-white border-gray-300"
                      />
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">{fmt(line.Amount)}</td>
                    <td className="py-2 pl-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeLine(idx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-3 pr-4 text-gray-700 text-xs leading-relaxed">{line.Description}</td>
                    <td className="py-3 text-right tabular-nums">{line.Qty.toFixed(2)}</td>
                    <td className="py-3 text-right tabular-nums">{fmt(line.UnitPrice)}</td>
                    <td className="py-3 text-right font-semibold tabular-nums">{fmt(line.Amount)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {editing && (
          <Button size="sm" variant="outline" className="mb-6 gap-1 text-gray-700 border-gray-300" onClick={addLine}>
            <Plus className="w-4 h-4" /> Add Line
          </Button>
        )}

        {/* Memo */}
        {(editing || memo) && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Memo / Notes</p>
            {editing ? (
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="text-sm bg-white border-gray-300"
                rows={2}
              />
            ) : (
              <p className="text-sm text-gray-700">{memo}</p>
            )}
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal:</span>
              <span className="tabular-nums">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tax:</span>
              <span className="tabular-nums">{fmt(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-gray-900 pt-2 mt-2">
              <span>Total:</span>
              <span className="tabular-nums">{fmt(total)}</span>
            </div>
            {paid > 0 && !linkedPayments.length && (
              <div className="flex justify-between text-green-700">
                <span>Paid:</span>
                <span className="tabular-nums">{fmt(paid)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Payment History */}
        {(linkedPayments.length > 0 || paid > 0) && (
          <div className="mt-6 mb-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Payment History</p>
              <Badge
                className={`border-0 text-xs ${
                  paymentStatus === "PAID"
                    ? "bg-green-100 text-green-800"
                    : paymentStatus === "PARTIAL"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {paymentStatus}
              </Badge>
            </div>
            {linkedPayments.length > 0 ? (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-1.5 font-semibold text-gray-600 text-xs">Date</th>
                      <th className="text-right py-1.5 font-semibold text-gray-600 text-xs">Amount Applied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linkedPayments.map((p, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-1.5 text-gray-700">{p.date ? new Date(p.date).toLocaleDateString() : "—"}</td>
                        <td className="py-1.5 text-right tabular-nums font-medium text-green-700">{fmt(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 mt-2">
                  {linkedPayments.length} payment{linkedPayments.length !== 1 ? "s" : ""}
                </p>
              </>
            ) : (
              <div className="flex justify-between text-sm text-green-700">
                <span>Paid:</span>
                <span className="tabular-nums font-medium">{fmt(paid)}</span>
              </div>
            )}
          </div>
        )}

        {/* Amount Due */}
        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between font-bold text-lg border-t-2 border-gray-900 pt-2 mt-1">
              <span>Amount Due:</span>
              <span className="tabular-nums">{fmt(amountDue)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 space-y-0.5">
          <p>☎ 6472609403 · ✉ accounting@rebar.shop · http://www.rebar.shop</p>
          <p>761487149RT0001</p>
        </div>
      </div>
    </div>
  );
}
