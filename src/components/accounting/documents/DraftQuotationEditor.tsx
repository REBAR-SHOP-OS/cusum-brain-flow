import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, X, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import brandLogo from "@/assets/brand-logo.png";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface Props {
  quoteId: string;
  onClose: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function DraftQuotationEditor({ quoteId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [expirationDate, setExpirationDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [projectName, setProjectName] = useState("");
  const [taxRate, setTaxRate] = useState(13);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quoteId)
        .single();
      if (error || !data) {
        toast({ title: "Error loading draft", description: error?.message, variant: "destructive" });
        onClose();
        return;
      }
      setQuoteNumber(data.quote_number);
      setQuoteDate(data.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      if (data.valid_until) setExpirationDate(data.valid_until.slice(0, 10));

      const meta = data.metadata as Record<string, any> | null;
      if (meta) {
        setCustomerName(meta.customer_name || data.salesperson || "");
        setCustomerAddress(meta.customer_address || "");
        setProjectName(meta.project_name || "");
        setTaxRate(meta.tax_rate ?? 13);
        setNotes(meta.notes || "");
        if (Array.isArray(meta.line_items) && meta.line_items.length > 0) {
          setItems(meta.line_items);
        }
      }
      setLoading(false);
    })();
  }, [quoteId, onClose]);

  const updateItem = useCallback((idx: number, field: keyof LineItem, value: string | number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }, []);

  const addRow = () => setItems((p) => [...p, { description: "", quantity: 1, unitPrice: 0 }]);
  const removeRow = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("quotes")
        .update({
          total_amount: total,
          valid_until: expirationDate || null,
          salesperson: customerName || null,
          metadata: {
            customer_name: customerName,
            customer_address: customerAddress,
            project_name: projectName,
            tax_rate: taxRate,
            notes,
            line_items: items,
          },
        } as any)
        .eq("id", quoteId);
      if (error) throw error;
      toast({ title: "Draft saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8">
      {/* Action buttons */}
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Draft
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" /> Print / PDF
        </Button>
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
            <h2 className="text-2xl font-black text-gray-900">Quotation {quoteNumber}</h2>
            <p className="text-sm text-gray-500 mt-1">Date: {quoteDate}</p>
            <div className="flex items-center gap-2 justify-end mt-1">
              <span className="text-sm text-gray-500">Valid Until:</span>
              <Input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="h-7 w-36 text-xs print:border-none print:p-0"
              />
            </div>
          </div>
        </div>

        {/* Customer & Project */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Customer</p>
            <Input
              placeholder="Customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-8 text-sm font-semibold print:border-none print:p-0 print:bg-transparent"
            />
            <Input
              placeholder="Address (optional)"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className="h-7 text-xs mt-1 print:border-none print:p-0 print:bg-transparent"
            />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Project</p>
            <Input
              placeholder="Project name (optional)"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="h-8 text-sm font-semibold print:border-none print:p-0 print:bg-transparent"
            />
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 font-bold">Description</th>
              <th className="text-right py-2 font-bold w-20">Qty</th>
              <th className="text-right py-2 font-bold w-28">Unit Price</th>
              <th className="text-right py-2 font-bold w-28">Amount</th>
              <th className="w-10 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-2 pr-2">
                  <Input
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    className="h-8 text-xs print:border-none print:p-0 print:bg-transparent"
                  />
                </td>
                <td className="py-2">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                    className="h-8 text-xs text-right tabular-nums print:border-none print:p-0 print:bg-transparent"
                  />
                </td>
                <td className="py-2">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                    className="h-8 text-xs text-right tabular-nums print:border-none print:p-0 print:bg-transparent"
                  />
                </td>
                <td className="py-2 text-right font-semibold tabular-nums text-xs">
                  {fmt(item.quantity * item.unitPrice)}
                </td>
                <td className="py-2 text-center print:hidden">
                  {items.length > 1 && (
                    <button onClick={() => removeRow(idx)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Button variant="outline" size="sm" onClick={addRow} className="mb-6 print:hidden gap-1 text-xs">
          <Plus className="w-3 h-3" /> Add Line
        </Button>

        {/* Notes */}
        <div className="mb-6">
          <p className="font-bold text-sm mb-1">Notes / Terms</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment terms, special conditions…"
            rows={3}
            className="w-full border rounded-md p-2 text-xs text-gray-700 resize-none print:border-none print:p-0"
          />
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal:</span>
              <span className="tabular-nums">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 flex items-center gap-1">
                Tax
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="h-6 w-14 text-xs text-right inline-block print:border-none print:p-0 print:bg-transparent"
                />
                %:
              </span>
              <span className="tabular-nums">{fmt(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t-2 border-gray-900 pt-2 mt-2">
              <span>Total:</span>
              <span className="tabular-nums">{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Signature area */}
        <div className="mt-12 grid grid-cols-2 gap-12">
          <div>
            <div className="border-b border-gray-300 pb-1 mb-1 h-12" />
            <p className="text-xs text-gray-500">Client Signature & Date</p>
          </div>
          <div>
            <div className="border-b border-gray-300 pb-1 mb-1 h-12" />
            <p className="text-xs text-gray-500">Rebar.Shop Authorized Signature</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-400 space-y-0.5">
          <p>☎ 6472609403 · ✉ accounting@rebar.shop · http://www.rebar.shop</p>
          <p>761487149RT0001</p>
        </div>
      </div>
    </div>
  );
}
