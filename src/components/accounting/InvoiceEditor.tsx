import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Printer, Pencil, Save, Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import brandLogo from "@/assets/brand-logo.png";
import { Badge } from "@/components/ui/badge";
import { QBAttachmentUploader } from "./QBAttachmentUploader";
import { ClassDepartmentPicker } from "./ClassDepartmentPicker";
import type { QBInvoice, QBCustomer, QBItem, QBPayment } from "@/hooks/useQuickBooksData";

interface LineItem {
  Description: string;
  Amount: number;
  Qty: number;
  UnitPrice: number;
  ServiceDate?: string;
  ItemRef?: { value: string; name: string };
}

interface Props {
  invoice: QBInvoice;
  customers: QBCustomer[];
  items: QBItem[];
  payments: QBPayment[];
  onUpdate: (invoiceId: string, updates: Record<string, unknown>) => Promise<unknown>;
  onClose: () => void;
  onSyncPayments?: () => Promise<void>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const TERMS_OPTIONS = ["Net 15", "Net 30", "Net 60", "Due on receipt"];

// Safe accessor for raw QB fields
function rawField(invoice: QBInvoice, key: string): unknown {
  return (invoice as unknown as Record<string, unknown>)[key];
}

function formatAddr(addr: Record<string, unknown> | undefined): string {
  if (!addr) return "";
  return [addr.Line1, addr.Line2, addr.Line3, addr.Line4, addr.City, addr.CountrySubDivisionCode, addr.PostalCode]
    .filter(Boolean)
    .join("\n");
}

function parseLineItems(invoice: QBInvoice): LineItem[] {
  const raw = rawField(invoice, "Line") as Array<Record<string, unknown>> | undefined;
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
        ServiceDate: (detail?.ServiceDate as string) || "",
        ItemRef: detail?.ItemRef as { value: string; name: string } | undefined,
      };
    });
}

export function InvoiceEditor({ invoice, customers, items, payments, onUpdate, onClose, onSyncPayments }: Props) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingPayments, setSyncingPayments] = useState(false);

  // Editable fields
  const [customerRef, setCustomerRef] = useState(invoice.CustomerRef);
  const [txnDate, setTxnDate] = useState(invoice.TxnDate?.split("T")[0] || "");
  const [dueDate, setDueDate] = useState(invoice.DueDate?.split("T")[0] || "");
  const [memo, setMemo] = useState(
    (rawField(invoice, "CustomerMemo") as { value: string } | undefined)?.value || ""
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(() => parseLineItems(invoice));

  // New QB header fields
  const [billAddr, setBillAddr] = useState(() => formatAddr(rawField(invoice, "BillAddr") as Record<string, unknown> | undefined));
  const [shipAddr, setShipAddr] = useState(() => formatAddr(rawField(invoice, "ShipAddr") as Record<string, unknown> | undefined));
  const [terms, setTerms] = useState(() => (rawField(invoice, "SalesTermRef") as { name?: string } | undefined)?.name || "");
  const [shipVia, setShipVia] = useState(() => (rawField(invoice, "ShipMethodRef") as { name?: string } | undefined)?.name || "");
  const [shipDate, setShipDate] = useState(() => ((rawField(invoice, "ShipDate") as string) || "").split("T")[0]);
  const [trackingNum, setTrackingNum] = useState(() => (rawField(invoice, "TrackingNum") as string) || "");
  const [poNumber, setPoNumber] = useState(() => {
    const customs = rawField(invoice, "CustomField") as Array<{ Name?: string; StringValue?: string }> | undefined;
    return customs?.find((c) => c.Name?.toLowerCase().includes("po"))?.StringValue || "";
  });
  const [salesRep, setSalesRep] = useState(() => {
    const customs = rawField(invoice, "CustomField") as Array<{ Name?: string; StringValue?: string }> | undefined;
    return customs?.find((c) => c.Name?.toLowerCase().includes("rep"))?.StringValue || "";
  });
  const [classQbId, setClassQbId] = useState<string | undefined>(() => {
    const ref = rawField(invoice, "ClassRef") as { value?: string } | undefined;
    return ref?.value;
  });
  const [departmentQbId, setDepartmentQbId] = useState<string | undefined>(() => {
    const ref = rawField(invoice, "DepartmentRef") as { value?: string } | undefined;
    return ref?.value;
  });

  // Tax rate
  const initTaxRate = useMemo(() => {
    const raw = rawField(invoice, "TxnTaxDetail") as Record<string, unknown> | undefined;
    const qbTotalTax = raw?.TotalTax as number | undefined;
    const initSubtotal = parseLineItems(invoice).reduce((s, l) => s + l.Amount, 0);
    if (qbTotalTax != null && initSubtotal > 0) return (qbTotalTax / initSubtotal) * 100;
    return 13;
  }, [invoice]);
  const [taxRatePercent, setTaxRatePercent] = useState(initTaxRate);

  const subtotal = useMemo(() => lineItems.reduce((s, l) => s + l.Amount, 0), [lineItems]);
  const safeTaxRate = Math.max(0, Math.min(100, taxRatePercent));
  const taxAmount = useMemo(() => {
    if (editing) return subtotal * (safeTaxRate / 100);
    const raw = rawField(invoice, "TxnTaxDetail") as Record<string, unknown> | undefined;
    return (raw?.TotalTax as number) || subtotal * 0.13;
  }, [invoice, subtotal, editing, safeTaxRate]);
  const total = subtotal + taxAmount;
  const paid = invoice.TotalAmt - invoice.Balance;
  const amountDue = total - paid;

  // Linked payments
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
            results.push({ date: (raw.TxnDate as string) || "", amount: (line.Amount as number) || 0 });
          }
        }
      }
    }
    return results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [payments, invoice.Id]);

  const paymentStatus = invoice.Balance === 0 ? "PAID" : linkedPayments.length > 0 ? "PARTIAL" : "OPEN";

  // Active items for dropdown
  const activeItems = useMemo(() => items.filter((i) => (i as unknown as Record<string, unknown>).Active !== false), [items]);

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

  const selectProduct = (idx: number, itemId: string) => {
    const found = items.find((i) => i.Id === itemId);
    if (!found) return;
    setLineItems((prev) => {
      const updated = [...prev];
      const line = { ...updated[idx] };
      const raw = found as unknown as Record<string, unknown>;
      line.ItemRef = { value: found.Id, name: found.Name };
      line.Description = (raw.Description as string) || found.Name;
      line.UnitPrice = (raw.UnitPrice as number) || line.UnitPrice;
      line.Amount = line.Qty * line.UnitPrice;
      updated[idx] = line;
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
              ...(l.ServiceDate ? { ServiceDate: l.ServiceDate } : {}),
            },
          })),
          { DetailType: "SubTotalLineDetail", Amount: subtotal, SubTotalLineDetail: {} },
        ],
        TxnTaxDetail: { TotalTax: taxAmount },
      };

      // Sparse: only include new fields if they have values
      if (billAddr) updates.BillAddr = { Line1: billAddr };
      if (shipAddr) updates.ShipAddr = { Line1: shipAddr };
      if (terms) updates.SalesTermRef = { name: terms };
      if (shipVia) updates.ShipMethodRef = { name: shipVia };
      if (shipDate) updates.ShipDate = shipDate;
      if (trackingNum) updates.TrackingNum = trackingNum;
      // Custom fields (PO#, Sales Rep) via CustomField array
      const customFields: Array<{ Name: string; StringValue: string; Type: string }> = [];
      if (poNumber) customFields.push({ Name: "P.O. Number", StringValue: poNumber, Type: "StringType" });
      if (salesRep) customFields.push({ Name: "Sales Rep", StringValue: salesRep, Type: "StringType" });
      if (customFields.length) updates.CustomField = customFields;
      if (classQbId) updates.ClassRef = { value: classQbId };
      if (departmentQbId) updates.DepartmentRef = { value: departmentQbId };

      await onUpdate(invoice.Id, updates);
      setEditing(false);
    } catch (err) {
      toast({ title: "Update failed", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  // Helper: show a field row in view mode only if it has a value
  const ViewField = ({ label, value }: { label: string; value: string }) =>
    value ? (
      <div className="flex gap-2 text-sm">
        <span className="text-gray-400 min-w-[100px]">{label}:</span>
        <span className="text-gray-700 whitespace-pre-line">{value}</span>
      </div>
    ) : null;

  // Check if any service date exists for view mode column visibility
  const hasServiceDates = lineItems.some((l) => l.ServiceDate);

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

        {/* Bill To + Payment History row */}
        <div className="flex gap-6 mb-6">
          <div className="flex-1 p-4 bg-gray-50 rounded-lg">
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
                  <span className="truncate">{customerRef.name || "Select customer..."}</span>
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.Id} value={c.Id}>{c.DisplayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-base font-semibold text-gray-900">{customerRef.name || "Unknown"}</p>
            )}
          </div>

          {(linkedPayments.length > 0 || paid > 0) && (
            <div className="w-72 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Payment History</p>
                <Badge className={`border-0 text-[10px] ${paymentStatus === "PAID" ? "bg-green-100 text-green-800" : paymentStatus === "PARTIAL" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                  {paymentStatus}
                </Badge>
              </div>
              {linkedPayments.length > 0 ? (
                <>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left py-1 font-semibold text-gray-500">Date</th>
                        <th className="text-right py-1 font-semibold text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedPayments.map((p, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-1 text-gray-700">{p.date ? new Date(p.date).toLocaleDateString() : "—"}</td>
                          <td className="py-1 text-right tabular-nums font-medium text-green-700">{fmt(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    {linkedPayments.length} payment{linkedPayments.length !== 1 ? "s" : ""} · Total {fmt(paid)}
                  </p>
                </>
              ) : paid > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-700">Payments received: <span className="font-semibold text-green-700">{fmt(paid)}</span></p>
                  <p className="text-[10px] text-gray-400 italic">Detailed records pending sync</p>
                  {onSyncPayments && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] gap-1 w-full print:hidden"
                      disabled={syncingPayments}
                      onClick={async () => {
                        setSyncingPayments(true);
                        try {
                          await onSyncPayments();
                          toast({ title: "✅ Payment records synced" });
                        } catch (err) {
                          toast({ title: "Sync failed", description: String(err), variant: "destructive" });
                        } finally {
                          setSyncingPayments(false);
                        }
                      }}
                    >
                      {syncingPayments ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      {syncingPayments ? "Syncing..." : "Sync Payment Records"}
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* NEW: Invoice Detail Fields */}
        {editing ? (
          <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="col-span-1 space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-400">Billing Address</label>
              <Textarea value={billAddr} onChange={(e) => setBillAddr(e.target.value)} rows={3} className="text-sm bg-white border-gray-300 min-h-0" />
            </div>
            <div className="col-span-1 space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-400">Shipping Address</label>
              <Textarea value={shipAddr} onChange={(e) => setShipAddr(e.target.value)} rows={3} className="text-sm bg-white border-gray-300 min-h-0" />
            </div>
            <div className="col-span-1 space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-400">Terms</label>
              <Select value={terms} onValueChange={setTerms}>
                <SelectTrigger className="h-8 bg-white border-gray-300 text-sm">
                  <SelectValue placeholder="Select terms..." />
                </SelectTrigger>
                <SelectContent>
                  {TERMS_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="text-[10px] uppercase tracking-widest text-gray-400">Ship Via</label>
              <Input value={shipVia} onChange={(e) => setShipVia(e.target.value)} className="h-8 text-sm bg-white border-gray-300" placeholder="e.g. UPS" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-400">Shipping Date</label>
              <Input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} className="h-8 text-sm bg-white border-gray-300" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-400">Tracking No.</label>
              <Input value={trackingNum} onChange={(e) => setTrackingNum(e.target.value)} className="h-8 text-sm bg-white border-gray-300" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-400">P.O. Number</label>
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="h-8 text-sm bg-white border-gray-300" />
            </div>
             <div className="col-span-3 space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-400">Sales Rep</label>
              <Input value={salesRep} onChange={(e) => setSalesRep(e.target.value)} className="h-8 text-sm bg-white border-gray-300 max-w-xs" />
            </div>
            <div className="col-span-3 grid grid-cols-2 gap-4">
              <ClassDepartmentPicker type="class" value={classQbId} onChange={setClassQbId} />
              <ClassDepartmentPicker type="department" value={departmentQbId} onChange={setDepartmentQbId} />
            </div>
          </div>
        ) : (
          /* View mode: only show fields that have values */
          (billAddr || shipAddr || terms || shipVia || shipDate || trackingNum || poNumber || salesRep) ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-6 p-4 bg-gray-50 rounded-lg">
              <ViewField label="Billing Address" value={billAddr} />
              <ViewField label="Shipping Address" value={shipAddr} />
              <ViewField label="Terms" value={terms} />
              <ViewField label="Ship Via" value={shipVia} />
              <ViewField label="Ship Date" value={shipDate ? new Date(shipDate).toLocaleDateString() : ""} />
              <ViewField label="Tracking No." value={trackingNum} />
              <ViewField label="P.O. Number" value={poNumber} />
              <ViewField label="Sales Rep" value={salesRep} />
            </div>
          ) : null
        )}

        {/* Line Items */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-900">
              {(editing || hasServiceDates) && <th className="text-left py-2 font-bold w-28">Service Date</th>}
              {editing && activeItems.length > 0 && <th className="text-left py-2 font-bold w-40">Product/Service</th>}
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
                      <Input type="date" value={line.ServiceDate || ""} onChange={(e) => updateLineItem(idx, "ServiceDate", e.target.value)} className="h-8 text-sm bg-white border-gray-300 w-28" />
                    </td>
                    {activeItems.length > 0 && (
                      <td className="py-2 pr-2">
                        <Select value={line.ItemRef?.value || ""} onValueChange={(val) => selectProduct(idx, val)}>
                          <SelectTrigger className="h-8 text-sm bg-white border-gray-300 w-40">
                            <span className="truncate text-left">{line.ItemRef?.name || "Select..."}</span>
                          </SelectTrigger>
                          <SelectContent>
                            {activeItems.map((item) => (
                              <SelectItem key={item.Id} value={item.Id}>{item.Name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    <td className="py-2 pr-2">
                      <Input value={line.Description} onChange={(e) => updateLineItem(idx, "Description", e.target.value)} className="h-8 text-sm bg-white border-gray-300" />
                    </td>
                    <td className="py-2 px-1">
                      <Input type="number" value={line.Qty} onChange={(e) => updateLineItem(idx, "Qty", e.target.value)} className="h-8 text-sm text-right w-20 bg-white border-gray-300" />
                    </td>
                    <td className="py-2 px-1">
                      <Input type="number" step="0.01" value={line.UnitPrice} onChange={(e) => updateLineItem(idx, "UnitPrice", e.target.value)} className="h-8 text-sm text-right w-24 bg-white border-gray-300" />
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
                    {hasServiceDates && (
                      <td className="py-3 pr-2 text-gray-500 text-xs">{line.ServiceDate ? new Date(line.ServiceDate).toLocaleDateString() : ""}</td>
                    )}
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
              <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} className="text-sm bg-white border-gray-300" rows={2} />
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
            <div className="flex justify-between items-center">
              {editing ? (
                <label className="flex items-center gap-1 text-gray-500">
                  <span>HST (ON)</span>
                  <input
                    type="number" min={0} max={100} step={0.01} value={taxRatePercent}
                    onChange={(e) => setTaxRatePercent(Math.max(0, Math.min(100, Number(e.target.value))))}
                    className="w-16 h-6 text-xs text-center border border-gray-300 rounded bg-white"
                  />
                  <span>%:</span>
                </label>
              ) : (
                <span className="text-gray-500">HST (ON) {safeTaxRate.toFixed(0)}%:</span>
              )}
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

        {/* Amount Due */}
        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between font-bold text-lg border-t-2 border-gray-900 pt-2 mt-1">
              <span>Amount Due:</span>
              <span className="tabular-nums">{fmt(amountDue)}</span>
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div className="mt-6 print:hidden">
          <QBAttachmentUploader entityType="Invoice" entityId={invoice.Id} />
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
