import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Printer, X, Plus, Trash2, Save, Loader2, Search, ChevronDown, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
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

interface CustomerOption {
  id: string;
  name: string;
  billing_street1?: string | null;
  billing_city?: string | null;
  billing_province?: string | null;
  billing_postal_code?: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  unit_price: number | null;
  description: string | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const inputCls = "bg-white text-gray-900 border-gray-300 placeholder:text-gray-400";

export function DraftQuotationEditor({ quoteId, onClose }: Props) {
  const { companyId } = useCompanyId();
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

  // Customer dropdown state
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [addingNewCustomer, setAddingNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");

  // Product dropdown state
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productOpenIdx, setProductOpenIdx] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");

  // Load quote data + customers + products
  useEffect(() => {
    const loadAll = async () => {
      const [quoteRes, custRes, prodRes] = await Promise.all([
        supabase.from("quotes").select("*").eq("id", quoteId).single(),
        companyId
          ? supabase
              .from("customers")
              .select("id, name, billing_street1, billing_city, billing_province, billing_postal_code")
              .eq("company_id", companyId)
              .order("name")
          : Promise.resolve({ data: [], error: null }),
        companyId
          ? supabase
              .from("qb_items")
              .select("id, name, unit_price, description")
              .eq("company_id", companyId)
              .neq("type", "Category")
              .eq("is_deleted", false)
              .order("name")
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (quoteRes.error || !quoteRes.data) {
        toast({ title: "Error loading draft", description: quoteRes.error?.message, variant: "destructive" });
        onClose();
        return;
      }

      const data = quoteRes.data;
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

      if (custRes.data) setCustomers(custRes.data as CustomerOption[]);
      if (prodRes.data) setProducts(prodRes.data as ProductOption[]);

      setLoading(false);
    };
    loadAll();
  }, [quoteId, onClose, companyId]);

  const filteredCustomers = useMemo(
    () =>
      customers.filter((c) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase())
      ),
    [customers, customerSearch]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((p) =>
        (p.name || "").toLowerCase().includes(productSearch.toLowerCase())
      ),
    [products, productSearch]
  );

  const selectCustomer = (c: CustomerOption) => {
    setCustomerName(c.name);
    const addrParts = [c.billing_street1, c.billing_city, c.billing_province, c.billing_postal_code].filter(Boolean);
    if (addrParts.length) setCustomerAddress(addrParts.join(", "));
    setCustomerOpen(false);
    setCustomerSearch("");
  };

  const handleAddNewCustomer = async () => {
    if (!newCustName.trim() || !companyId) return;
    const { data, error } = await supabase
      .from("customers")
      .insert({ name: newCustName.trim(), company_id: companyId, billing_street1: newCustAddress || null } as any)
      .select("id, name, billing_street1, billing_city, billing_province, billing_postal_code")
      .single();
    if (error) {
      toast({ title: "Failed to create customer", description: error.message, variant: "destructive" });
      return;
    }
    const newCust = data as CustomerOption;
    setCustomers((prev) => [newCust, ...prev]);
    selectCustomer(newCust);
    setAddingNewCustomer(false);
    setNewCustName("");
    setNewCustAddress("");
    toast({ title: "Customer created" });
  };

  const selectProduct = (idx: number, p: ProductOption) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, description: p.name || "", unitPrice: p.unit_price ?? it.unitPrice }
          : it
      )
    );
    setProductOpenIdx(null);
    setProductSearch("");
  };

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

      <div className="bg-white text-gray-900 w-[210mm] min-h-[297mm] p-10 shadow-2xl print:shadow-none print:p-8 print:w-full">
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
            <h2 className="text-2xl font-black text-gray-900">Quotation #{quoteNumber}</h2>
            <div className="mt-2 text-sm space-y-1">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-gray-500 font-medium">Quote Date:</span>
                <span className="text-gray-900">{quoteDate}</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-gray-500 font-medium">Due Date:</span>
                <Input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className={`h-7 w-36 text-xs ${inputCls} print:border-none print:p-0`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* BILL TO + Shipping */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* BILL TO */}
          <div className="border border-gray-300 rounded-md p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Bill To</p>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center justify-between w-full h-8 px-3 text-sm font-semibold rounded-md border bg-white text-gray-900 border-gray-300 hover:border-gray-400 transition-colors text-left print:border-none print:p-0"
                >
                  <span className={customerName ? "text-gray-900" : "text-gray-400"}>
                    {customerName || "Select customer…"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 print:hidden" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 bg-white border border-gray-200 shadow-lg z-[100]" align="start">
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input
                      placeholder="Search customers…"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className={`h-7 pl-7 text-xs ${inputCls}`}
                      autoFocus
                    />
                  </div>
                </div>
                {!addingNewCustomer ? (
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                    onClick={() => setAddingNewCustomer(true)}
                  >
                    <UserPlus className="w-4 h-4" />
                    + Add New Customer
                  </button>
                ) : (
                  <div className="p-2 border-b border-gray-100 space-y-1.5">
                    <Input placeholder="Customer name" value={newCustName} onChange={(e) => setNewCustName(e.target.value)} className={`h-7 text-xs ${inputCls}`} autoFocus />
                    <Input placeholder="Address (optional)" value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} className={`h-7 text-xs ${inputCls}`} />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-xs" onClick={handleAddNewCustomer} disabled={!newCustName.trim()}>Create</Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setAddingNewCustomer(false); setNewCustName(""); setNewCustAddress(""); }}>Cancel</Button>
                    </div>
                  </div>
                )}
                <div className="max-h-48 overflow-y-auto">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 text-xs">No customers found</p>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button key={c.id} className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-gray-100 transition-colors truncate" onClick={() => selectCustomer(c)}>
                        {c.name}
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Input
              placeholder="Address"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className={`h-7 text-xs mt-2 ${inputCls} print:border-none print:p-0 print:bg-transparent`}
            />
          </div>

          {/* Shipping Address */}
          <div className="border border-gray-300 rounded-md p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Shipping Address</p>
            <Input
              placeholder="Shipping address (optional)"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className={`h-8 text-sm ${inputCls} print:border-none print:p-0 print:bg-transparent`}
            />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Ship Date:</span>
              <Input
                type="date"
                className={`h-7 text-xs flex-1 ${inputCls} print:border-none print:p-0`}
              />
            </div>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 font-bold text-gray-900">Description</th>
              <th className="text-right py-2 font-bold text-gray-900 w-20">Qty</th>
              <th className="text-right py-2 font-bold text-gray-900 w-28">Unit Price</th>
              <th className="text-right py-2 font-bold text-gray-900 w-28">Amount</th>
              <th className="w-10 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-2 pr-2">
                  {/* Product searchable dropdown */}
                  <Popover
                    open={productOpenIdx === idx}
                    onOpenChange={(open) => {
                      setProductOpenIdx(open ? idx : null);
                      if (!open) setProductSearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        className={`flex items-center justify-between w-full h-8 px-2 text-xs rounded-md border bg-white text-gray-900 border-gray-300 hover:border-gray-400 transition-colors text-left print:border-none print:p-0`}
                      >
                        <span className={item.description ? "text-gray-900" : "text-gray-400"}>
                          {item.description || "Select product…"}
                        </span>
                        <ChevronDown className="w-3 h-3 text-gray-400 shrink-0 print:hidden" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0 bg-white border border-gray-200 shadow-lg z-[100]" align="start">
                      <div className="p-2 border-b border-gray-100">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <Input
                            placeholder="Search or type custom…"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className={`h-7 pl-7 text-xs ${inputCls}`}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && productSearch.trim()) {
                                updateItem(idx, "description", productSearch.trim());
                                setProductOpenIdx(null);
                                setProductSearch("");
                              }
                            }}
                          />
                        </div>
                      </div>
                      {productSearch.trim() && (
                        <button
                          className="w-full text-left px-3 py-2 text-xs text-blue-600 font-medium hover:bg-blue-50 border-b border-gray-100"
                          onClick={() => {
                            updateItem(idx, "description", productSearch.trim());
                            setProductOpenIdx(null);
                            setProductSearch("");
                          }}
                        >
                          Use "{productSearch.trim()}" as custom item
                        </button>
                      )}
                      <div className="max-h-48 overflow-y-auto">
                        {filteredProducts.length === 0 ? (
                          <p className="text-center text-gray-400 py-4 text-xs">No products found</p>
                        ) : (
                          filteredProducts.map((p) => (
                            <button
                              key={p.id}
                              className="w-full text-left px-3 py-1.5 hover:bg-gray-100 transition-colors"
                              onClick={() => selectProduct(idx, p)}
                            >
                              <p className="text-xs text-gray-900 font-medium truncate">{p.name}</p>
                              {p.unit_price != null && (
                                <p className="text-[10px] text-gray-500">{fmt(p.unit_price)}</p>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </td>
                <td className="py-2">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                    className={`h-8 text-xs text-right tabular-nums ${inputCls} print:border-none print:p-0 print:bg-transparent`}
                  />
                </td>
                <td className="py-2">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                    className={`h-8 text-xs text-right tabular-nums ${inputCls} print:border-none print:p-0 print:bg-transparent`}
                  />
                </td>
                <td className="py-2 text-right font-semibold tabular-nums text-xs text-gray-900">
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
          <p className="font-bold text-sm mb-1 text-gray-900">Notes / Terms</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment terms, special conditions…"
            rows={3}
            className={`w-full border rounded-md p-2 text-xs resize-none ${inputCls} print:border-none print:p-0`}
          />
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal:</span>
              <span className="tabular-nums text-gray-900">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 flex items-center gap-1">
                HST (ON)
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className={`h-6 w-14 text-xs text-right inline-block ${inputCls} print:border-none print:p-0 print:bg-transparent`}
                />
                %:
              </span>
              <span className="tabular-nums text-gray-900">{fmt(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-gray-900 pt-2 mt-2">
              <span className="text-gray-900">Total:</span>
              <span className="tabular-nums text-gray-900">{fmt(total)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t-2 border-gray-900 pt-2 mt-1">
              <span className="text-gray-900">Amount Due:</span>
              <span className="tabular-nums text-gray-900">{fmt(total)}</span>
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
