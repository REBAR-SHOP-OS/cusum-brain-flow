import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Printer, X, Plus, Trash2, Save, Loader2, Search, ChevronDown, UserPlus, Mail, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { toast } from "@/components/ui/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { DocumentAttachments } from "@/components/accounting/DocumentAttachments";
import brandLogo from "@/assets/brand-logo.png";

interface LineItem {
  description: string;
  detail?: string;
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
  email?: string | null;
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
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [expirationDate, setExpirationDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [projectName, setProjectName] = useState("");
  const [shipDate, setShipDate] = useState<Date | undefined>();
  const [taxRate, setTaxRate] = useState(13);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState<string[]>([]);
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);

  // Customer dropdown state
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [addingNewCustomer, setAddingNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");

  // Product dropdown state
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productOpenIdx, setProductOpenIdx] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState("");

  // Load quote data + customers + products
  // Dynamic customer search — query on type instead of loading all upfront
  useEffect(() => {
    if (!companyId || !customerOpen) return;
    const timeout = setTimeout(async () => {
      let q = supabase
        .from("v_customers_clean" as any)
        .select("customer_id, display_name, company_name, email")
        .eq("company_id", companyId)
        .order("display_name")
        .limit(50);
      if (customerSearch.trim()) {
        q = q.or(`display_name.ilike.%${customerSearch.trim()}%,company_name.ilike.%${customerSearch.trim()}%`);
      }
      const { data } = await q;
      if (data) {
        const normalized = (data as any[]).map((c) => ({
          ...c,
          id: c.id || c.customer_id || c.Id || "",
          name: c.name || c.display_name || c.company_name || "Unknown",
        }));
        setCustomers(normalized as CustomerOption[]);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [companyId, customerSearch, customerOpen]);

  useEffect(() => {
    const loadAll = async () => {
      const [quoteRes, prodRes] = await Promise.all([
        supabase.from("quotes").select("*").eq("id", quoteId).single(),
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
        if (meta.customer_email) {
          setCustomerEmail(meta.customer_email);
        } else {
          // Fallback chain: customers → contacts → sales_contacts
          const resolvedName = meta.customer_name || data.salesperson || "";
          if (resolvedName && companyId) {
            const { data: cust } = await supabase
              .from("customers")
              .select("id, email")
              .eq("company_id", companyId)
              .ilike("name", resolvedName)
              .limit(1)
              .maybeSingle();
            if (cust?.email) {
              setCustomerEmail(cust.email);
            } else {
              // Fallback 1: contacts table
              const custId = cust?.id;
              if (custId) {
                const { data: contact } = await supabase
                  .from("contacts")
                  .select("email")
                  .eq("customer_id", custId)
                  .not("email", "is", null)
                  .limit(1)
                  .maybeSingle();
                if (contact?.email) {
                  setCustomerEmail(contact.email);
                }
              }
              if (!cust?.email) {
                // Fallback 2: sales_contacts
                const { data: sc } = await supabase
                  .from("sales_contacts")
                  .select("email")
                  .eq("company_id", companyId)
                  .or(`name.ilike.%${resolvedName}%,company_name.ilike.%${resolvedName}%`)
                  .not("email", "is", null)
                  .limit(1)
                  .maybeSingle();
                if (sc?.email) setCustomerEmail(sc.email);
              }
            }
          }
        }
        let resolvedNotes = meta.notes || "";
        if (!resolvedNotes && (meta.inclusions || meta.exclusions || meta.assumptions)) {
          const parts: string[] = [];
          if (meta.inclusions?.length) {
            parts.push("INCLUSIONS:", ...meta.inclusions.map((i: string) => `✅ ${i}`), "");
          }
          if (meta.exclusions?.length) {
            parts.push("EXCLUSIONS:", ...meta.exclusions.map((e: string) => `➖ ${e}`), "");
          }
          if (meta.assumptions?.length) {
            parts.push("NOTES:", ...meta.assumptions.map((a: string) => `• ${a}`));
          }
          resolvedNotes = parts.join("\n");
        }
        setNotes(resolvedNotes);
        if (Array.isArray(meta.terms)) {
          setTerms(meta.terms);
        }
        if (Array.isArray(meta.line_items) && meta.line_items.length > 0) {
          setItems(meta.line_items.map((li: any) => ({
            description: li.description || "",
            detail: li.detail || "",
            quantity: Number(li.quantity) || 1,
            unitPrice: Number(li.unitPrice ?? li.unit_price) || 0,
          })));
        }
      }

      if (prodRes.data) setProducts(prodRes.data as ProductOption[]);

      setLoading(false);
    };
    loadAll();
  }, [quoteId, onClose, companyId]);

  const filteredCustomers = customers;

  const filteredProducts = useMemo(
    () =>
      products.filter((p) =>
        (p.name || "").toLowerCase().includes(productSearch.toLowerCase())
      ),
    [products, productSearch]
  );

  const selectCustomer = async (c: CustomerOption) => {
    setCustomerName(c.name);
    const addrParts = [c.billing_street1, c.billing_city, c.billing_province, c.billing_postal_code].filter(Boolean);
    if (addrParts.length) setCustomerAddress(addrParts.join(", "));
    setCustomerOpen(false);
    setCustomerSearch("");

    if (c.email) {
      setCustomerEmail(c.email);
      return;
    }

    // Fallback 1: contacts table by customer_id
    const { data: contact } = await supabase
      .from("contacts")
      .select("email")
      .eq("customer_id", c.id)
      .not("email", "is", null)
      .limit(1)
      .maybeSingle();
    if (contact?.email) {
      setCustomerEmail(contact.email);
      return;
    }

    // Fallback 2: sales_contacts by name/company_name
    if (companyId) {
      const { data: sc } = await supabase
        .from("sales_contacts")
        .select("email")
        .eq("company_id", companyId)
        .or(`name.ilike.%${c.name}%,company_name.ilike.%${c.name}%`)
        .not("email", "is", null)
        .limit(1)
        .maybeSingle();
      if (sc?.email) setCustomerEmail(sc.email);
    }
  };

  const handleAddNewCustomer = async () => {
    if (!newCustName.trim() || !companyId) return;
    const { data, error } = await supabase
      .from("customers")
      .insert({ name: newCustName.trim(), company_id: companyId, email: newCustEmail || null, billing_street1: newCustAddress || null } as any)
      .select("id, name, email, billing_street1, billing_city, billing_province, billing_postal_code")
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
    setNewCustEmail("");
    setNewCustAddress("");
    toast({ title: "Customer created" });

    // Auto-push to QuickBooks (non-blocking)
    supabase.functions.invoke("quickbooks-oauth", {
      body: {
        action: "create-customer",
        displayName: newCust.name,
        email: newCustEmail || undefined,
        address: newCustAddress || undefined,
        localCustomerId: newCust.id,
      },
    }).then(({ data: qbRes }) => {
      if (qbRes?.qbCustomerId) console.log("Customer synced to QB:", qbRes.qbCustomerId);
    }).catch((err) => {
      console.warn("QB customer sync failed (non-blocking):", err);
    });
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
            customer_email: customerEmail || undefined,
            customer_address: customerAddress,
            project_name: projectName,
            tax_rate: taxRate,
            notes,
            terms,
            line_items: items.map(li => ({
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              unit_price: li.unitPrice,
              amount: li.quantity * li.unitPrice,
            })),
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

  const handleSendEmail = async () => {
    if (!customerEmail.trim()) return;
    setSendingEmail(true);
    try {
      // Save first to ensure latest data
      await handleSave();
      const data = await invokeEdgeFunction("send-quote-email", {
        quote_id: quoteId, customer_email: customerEmail.trim(), action: "send_quote",
      });
      toast({ title: "Email sent", description: data?.message || `Quotation sent to ${customerEmail}` });
      setEmailDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
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
      {/* Email dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Quotation to Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="customer-email" className="text-sm">Customer Email</Label>
              <Input
                id="customer-email"
                type="email"
                placeholder="customer@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will save the current draft and send a branded quotation email to the customer.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={sendingEmail}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail || !customerEmail.trim()} className="gap-2">
              {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {sendingEmail ? "Sending…" : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action buttons */}
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Draft
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEmailDialogOpen(true)} className="gap-2">
          <Mail className="w-4 h-4" /> Send Email
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
                    <Input placeholder="Email" type="email" value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} className={`h-7 text-xs ${inputCls}`} />
                    <Input placeholder="Address (optional)" value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} className={`h-7 text-xs ${inputCls}`} />
                    <div className="flex gap-1">
                      <Button size="sm" className="h-6 text-xs" onClick={handleAddNewCustomer} disabled={!newCustName.trim()}>Create</Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setAddingNewCustomer(false); setNewCustName(""); setNewCustEmail(""); setNewCustAddress(""); }}>Cancel</Button>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-7 text-xs flex-1 justify-start text-left font-normal",
                      !shipDate && "text-muted-foreground",
                      "print:border-none print:p-0 print:bg-transparent"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {shipDate ? format(shipDate, "MMM d, yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={shipDate}
                    onSelect={setShipDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
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
                        className={`flex items-center justify-between w-full min-h-[2rem] px-2 text-xs rounded-md border bg-white text-gray-900 border-gray-300 hover:border-gray-400 transition-colors text-left print:border-none print:p-0`}
                      >
                        <div className="flex flex-col">
                          <span className={item.description ? "text-gray-900" : "text-gray-400"}>
                            {item.description || "Select product…"}
                          </span>
                          {item.detail && (
                            <span className="text-[10px] text-gray-400 leading-tight">{item.detail}</span>
                          )}
                        </div>
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

        {/* Attachments */}
        <div className="mb-6 print:hidden">
          <DocumentAttachments entityType="quote" entityId={quoteId} />
        </div>

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

        {/* Accept Online Link */}
        <div className="mt-8 p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5 text-center print:border-gray-400 print:bg-gray-50">
          <p className="text-sm font-semibold text-gray-700 mb-1">To accept this quotation online, visit:</p>
          <a
            href={`https://cusum-brain-flow.lovable.app/accept-quote/${quoteId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline break-all print:text-black"
          >
            https://cusum-brain-flow.lovable.app/accept-quote/{quoteId}
          </a>
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
