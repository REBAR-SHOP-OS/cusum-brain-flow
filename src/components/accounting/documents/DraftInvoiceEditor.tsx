import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Printer, X, Plus, Trash2, Save, Loader2, Search, ChevronDown, UserPlus, Mail, DollarSign, AlertTriangle } from "lucide-react";
import { RecordPaymentDialog } from "@/components/accounting/RecordPaymentDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useQueryClient } from "@tanstack/react-query";
import brandLogo from "@/assets/brand-logo.png";

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  serviceDate?: string;
}

interface Props {
  invoiceId: string;
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

export function DraftInvoiceEditor({ invoiceId, onClose }: Props) {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [salesRep, setSalesRep] = useState("");
  const [taxRate, setTaxRate] = useState(13);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [linkCheckStatus, setLinkCheckStatus] = useState<{ stripe: boolean | null; qb: boolean | null }>({ stripe: null, qb: null });

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

  // Load invoice data + customers + products
  useEffect(() => {
    const loadAll = async () => {
      const [invRes, itemsRes, custRes, prodRes] = await Promise.all([
        supabase.from("sales_invoices").select("*").eq("id", invoiceId).single(),
        supabase.from("sales_invoice_items" as any).select("*").eq("invoice_id", invoiceId).order("sort_order"),
        companyId
          ? supabase
              .from("v_customers_clean" as any)
              .select("customer_id, display_name, company_name")
              .eq("company_id", companyId)
              .order("display_name")
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

      if (invRes.error || !invRes.data) {
        toast({ title: "Error loading invoice", description: invRes.error?.message, variant: "destructive" });
        onClose();
        return;
      }

      const inv = invRes.data;
      setInvoiceNumber(inv.invoice_number);
      setInvoiceDate(inv.issued_date || inv.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      if (inv.due_date) setDueDate(inv.due_date.slice(0, 10));
      setCustomerName(inv.customer_name || "");
      setCustomerCompany(inv.customer_company || "");
      setNotes(inv.notes || "");
      setStatus(inv.status || "draft");

      // Load line items from DB
      const loadedItems = itemsRes.data as any[] || [];
      if (loadedItems.length > 0) {
        setItems(loadedItems.map((it: any) => ({
          id: it.id,
          description: it.description || "",
          quantity: it.quantity || 1,
          unitPrice: it.unit_price || 0,
          serviceDate: it.service_date || "",
        })));
      } else {
        // Fallback chain to resolve line items from various sources
        let resolved = false;
        const quotationId = (inv as any).quotation_id;

        // 1. Try sales_quotation_items table
        if (!resolved && quotationId) {
          const { data: qItems } = await supabase
            .from("sales_quotation_items" as any)
            .select("description, quantity, unit_price, total, sort_order")
            .eq("quotation_id", quotationId)
            .order("sort_order");
          if (qItems && (qItems as any[]).length > 0) {
            const mapped = (qItems as any[]).map((qi: any) => ({
              description: qi.description || "",
              quantity: qi.quantity || 1,
              unitPrice: qi.unit_price || 0,
            }));
            setItems(mapped);
            resolved = true;
            // Persist to sales_invoice_items for future loads
            if (companyId) {
              const rows = (qItems as any[]).map((qi: any, idx: number) => ({
                invoice_id: invoiceId,
                company_id: companyId,
                description: qi.description || "",
                quantity: qi.quantity || 1,
                unit_price: qi.unit_price || 0,
                sort_order: qi.sort_order ?? idx,
              }));
              supabase.from("sales_invoice_items" as any).insert(rows as any).then(() => {});
            }
          }
        }

        // 2. Try quotes.metadata.line_items (primary source for all quotations)
        if (!resolved) {
          let sourceQuote: any = null;
          
          // 2a. Try via quotation_id -> sales_quotations -> quotes
          if (quotationId) {
            const { data: sq } = await supabase
              .from("sales_quotations")
              .select("quotation_number")
              .eq("id", quotationId)
              .maybeSingle();
            if (sq?.quotation_number) {
              const { data: q } = await supabase
                .from("quotes")
                .select("metadata")
                .eq("quote_number", sq.quotation_number)
                .maybeSingle();
              sourceQuote = q;
            }
            // Fallback: try quotes by id directly (quotationId may actually be a quotes.id)
            if (!sourceQuote) {
              const { data: q } = await supabase
                .from("quotes")
                .select("metadata")
                .eq("id", quotationId)
                .maybeSingle();
              if (q) sourceQuote = q;
            }
          }
          
          // 2b. Try via invoice metadata.source_quote_id (set during accept_and_convert)
          if (!sourceQuote) {
            const invMeta = (inv as any).metadata || {};
            const sourceQuoteId = invMeta.source_quote_id;
            if (sourceQuoteId) {
              const { data: q } = await supabase
                .from("quotes")
                .select("metadata")
                .eq("id", sourceQuoteId)
                .maybeSingle();
              if (q) sourceQuote = q;
            }
          }
          
          if (sourceQuote?.metadata) {
            const metaItems = (sourceQuote.metadata as any).line_items as any[] | undefined;
            if (metaItems && metaItems.length > 0) {
              const mapped = metaItems.map((mi: any) => {
                // Use clean description only (strip project-specific detail for QB matching)
                let desc = mi.description || mi.name || "";
                // If description still contains " – " project suffix from legacy data, strip it
                const dashIdx = desc.indexOf(" – ");
                if (dashIdx > 0) desc = desc.substring(0, dashIdx).trim();
                const emDashIdx = desc.indexOf(" — ");
                if (emDashIdx > 0) desc = desc.substring(0, emDashIdx).trim();
                return {
                  description: desc,
                  quantity: Number(mi.quantity) || Number(mi.qty) || 1,
                  unitPrice: Number(mi.unitPrice) || Number(mi.unit_price) || Number(mi.price) || 0,
                };
              });
              setItems(mapped);
              resolved = true;
              // Persist to sales_invoice_items
              if (companyId) {
                const rows = mapped.map((m, idx) => ({
                  invoice_id: invoiceId,
                  company_id: companyId,
                  description: m.description,
                  quantity: m.quantity,
                  unit_price: m.unitPrice,
                  sort_order: idx,
                }));
                supabase.from("sales_invoice_items" as any).insert(rows as any).then(() => {});
              }
            }
          }
        }

        // 3. Parse invoice metadata.line_items (if present)
        if (!resolved) {
          const meta = (inv as any).metadata || {};
          const metaItems = meta.line_items as any[] | undefined;
          if (metaItems && metaItems.length > 0) {
            setItems(metaItems.map((mi: any) => ({
              description: mi.description || mi.name || "",
              quantity: mi.quantity || mi.qty || 1,
              unitPrice: mi.unit_price || mi.unitPrice || mi.price || 0,
            })));
            resolved = true;
          }
        }

        // 4. Last fallback: single line with total amount
        if (!resolved && inv.amount && Number(inv.amount) > 0) {
          setItems([{ description: "Invoice total", quantity: 1, unitPrice: Number(inv.amount) }]);
        }
      }

      // Store customer email and amount for email sending
      const metaForEmail = (inv as any).metadata || {};
      let resolvedEmail = metaForEmail.customer_email || (inv as any).customer_email || "";
      
      // Fallback: look up customer email from customers table by name
      if (!resolvedEmail && (inv.customer_name || inv.customer_company) && companyId) {
        const searchName = inv.customer_name || inv.customer_company || "";
        const { data: custMatch } = await supabase
          .from("customers")
          .select("email")
          .eq("company_id", companyId)
          .or(`name.ilike.%${searchName}%,company_name.ilike.%${searchName}%`)
          .limit(1)
          .maybeSingle();
        if (custMatch?.email) resolvedEmail = custMatch.email;
      }
      
      setCustomerEmail(resolvedEmail);
      setInvoiceAmount(Number(inv.amount) || 0);

      if (custRes.data) {
        const normalized = (custRes.data as any[]).map((c) => ({
          ...c,
          id: c.id || c.customer_id || c.Id || "",
          name: c.name || c.display_name || c.company_name || "Unknown",
        }));
        setCustomers(normalized as CustomerOption[]);
      }
      if (prodRes.data) setProducts(prodRes.data as ProductOption[]);

      setLoading(false);
    };
    loadAll();
  }, [invoiceId, onClose, companyId]);

  const filteredCustomers = useMemo(
    () => customers.filter((c) => (c.name || "").toLowerCase().includes(customerSearch.toLowerCase())),
    [customers, customerSearch]
  );

  const filteredProducts = useMemo(
    () => products.filter((p) => (p.name || "").toLowerCase().includes(productSearch.toLowerCase())),
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
        i === idx ? { ...it, description: p.name || "", unitPrice: p.unit_price ?? it.unitPrice } : it
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
      // Update invoice header
      const { error: invErr } = await supabase
        .from("sales_invoices")
        .update({
          customer_name: customerName || null,
          customer_company: customerCompany || null,
          amount: total,
          due_date: dueDate || null,
          issued_date: invoiceDate || null,
          notes: notes || null,
        })
        .eq("id", invoiceId);
      if (invErr) throw invErr;

      // Delete existing items and re-insert
      await supabase.from("sales_invoice_items" as any).delete().eq("invoice_id", invoiceId);

      if (items.length > 0 && companyId) {
        const rows = items.map((it, idx) => ({
          invoice_id: invoiceId,
          company_id: companyId,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          sort_order: idx,
        }));
        const { error: itemsErr } = await supabase.from("sales_invoice_items" as any).insert(rows as any);
        if (itemsErr) throw itemsErr;
      }

      queryClient.invalidateQueries({ queryKey: ["sales_invoices"] });
      toast({ title: "Invoice saved" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  const handleSendEmail = async () => {
    const email = recipientEmail || customerEmail;
    if (!email) {
      toast({ title: "No email address", description: "Enter a recipient email address", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    try {
      // Auto-save before sending to ensure DB matches what the email shows
      await handleSave();
      // Try to get a Stripe payment link
      let paymentUrl = "";
      try {
        const { data: stripeData } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "create-payment-link",
            amount: total,
            currency: "cad",
            invoiceNumber,
            customerName: customerName || undefined,
            qbInvoiceId: invoiceId,
          },
        });
        if (stripeData?.paymentLink?.stripe_url) {
          paymentUrl = stripeData.paymentLink.stripe_url;
        }
      } catch {
        // Stripe not configured — continue without payment link
      }

      // Auto-push invoice to QuickBooks to get a real InvoiceLink
      let qbPayUrl = "";
      try {
        const qbItems = items.map(it => ({
          description: it.description,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
        }));

        const { data: qbData } = await supabase.functions.invoke("quickbooks-oauth", {
          body: {
            action: "create-invoice",
            customerName: customerName || undefined,
            items: qbItems.length > 0 ? qbItems : [{ description: `Invoice ${invoiceNumber}`, unitPrice: total, quantity: 1 }],
            dueDate: dueDate || undefined,
            memo: `ERP Invoice ${invoiceNumber}`,
          },
        });
        if (qbData?.invoiceLink) {
          qbPayUrl = qbData.invoiceLink;
        } else if (qbData?.invoice?.InvoiceLink) {
          qbPayUrl = qbData.invoice.InvoiceLink;
        }
      } catch {
        // QB not connected — continue without QB link
      }

      // Fallback: check accounting_mirror if QB push didn't return a link
      if (!qbPayUrl) {
        try {
          const { data: qbMirror } = await supabase
            .from("accounting_mirror")
            .select("data, quickbooks_id")
            .eq("entity_type", "Invoice")
            .ilike("data->>DocNumber", invoiceNumber)
            .maybeSingle();
          if (qbMirror) {
            const mirrorData = qbMirror.data as Record<string, unknown>;
            const invoiceLink = mirrorData?.InvoiceLink as string | undefined;
            if (invoiceLink) qbPayUrl = invoiceLink;
          }
        } catch (_e) { /* accounting_mirror not available */ }
      }

      // Look up existing Stripe payment link
      if (!paymentUrl) {
        try {
          const { data: existingLink } = await supabase
            .from("stripe_payment_links")
            .select("stripe_url")
            .or(`qb_invoice_id.eq.${invoiceId},invoice_number.eq.${invoiceNumber}`)
            .eq("status", "active")
            .maybeSingle();
          if (existingLink?.stripe_url) {
            paymentUrl = existingLink.stripe_url;
          }
        } catch (_e) { /* stripe_payment_links not available */ }
      }

      // Build dual payment buttons
      const payBtns: string[] = [];
      if (paymentUrl) {
        payBtns.push(`<a href="${paymentUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:0.5px;width:80%;text-align:center;">💳 Pay via Stripe - ${fmt(total)}</a>
          <p style="text-align:center;font-size:12px;color:#888;margin-top:4px;">Secure payment powered by Stripe</p>`);
      }
      if (qbPayUrl) {
        payBtns.push(`<a href="${qbPayUrl}" style="display:inline-block;background:#2ca01c;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:0.5px;width:80%;text-align:center;">📋 Pay via QuickBooks</a>
          <p style="text-align:center;font-size:12px;color:#888;margin-top:4px;">Pay through QuickBooks Online</p>`);
      }
      const payBtnHtml = payBtns.length > 0
        ? `<div style="text-align:center;margin:24px 0;">${payBtns.join('<div style="margin-top:12px;"></div>')}</div>`
        : "";

      // Build branded line items table
      const itemRows = items.map(it =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#333;">${it.description}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;color:#333;">${it.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;color:#333;">${fmt(it.unitPrice)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;color:#333;">${fmt(it.quantity * it.unitPrice)}</td>
        </tr>`
      ).join("");

      const hstRate = taxRate;

      const emailBody = `
        <p style="font-size:15px;color:#333;margin:0 0 16px;">Dear ${customerName || "Customer"},</p>
        <p style="font-size:14px;color:#333;margin:0 0 20px;">Please find your invoice <strong>#${invoiceNumber}</strong> details below.</p>
        
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead>
            <tr style="background:#1a1a2e;">
              <th style="padding:10px 12px;text-align:left;color:#fff;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
              <th style="padding:10px 12px;text-align:center;color:#fff;font-size:12px;font-weight:600;text-transform:uppercase;">Qty</th>
              <th style="padding:10px 12px;text-align:right;color:#fff;font-size:12px;font-weight:600;text-transform:uppercase;">Unit Price</th>
              <th style="padding:10px 12px;text-align:right;color:#fff;font-size:12px;font-weight:600;text-transform:uppercase;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        
        <div style="border-top:2px solid #1a1a2e;padding-top:12px;margin-top:8px;">
          <table style="width:100%;font-size:13px;">
            <tr><td style="padding:4px 12px;text-align:right;color:#666;">Subtotal:</td><td style="padding:4px 12px;text-align:right;font-weight:600;color:#333;width:120px;">${fmt(subtotal)}</td></tr>
            <tr><td style="padding:4px 12px;text-align:right;color:#666;">HST (${hstRate}%):</td><td style="padding:4px 12px;text-align:right;font-weight:600;color:#333;">${fmt(taxAmount)}</td></tr>
            <tr><td style="padding:8px 12px;text-align:right;font-size:16px;font-weight:700;color:#1a1a2e;">Total Due:</td><td style="padding:8px 12px;text-align:right;font-size:16px;font-weight:700;color:#dc2626;">${fmt(total)}</td></tr>
          </table>
        </div>

        ${payBtnHtml}

        <div style="background:#f8f9fc;border-radius:8px;padding:12px 16px;margin:20px 0;font-size:13px;color:#555;">
          <strong>Due Date:</strong> ${dueDate || "Upon receipt"}<br/>
          ${notes ? `<strong>Notes:</strong> ${notes}` : ""}
        </div>
        
        <p style="font-size:14px;color:#333;">Thank you for your business!</p>
      `;

      const { error } = await supabase.functions.invoke("gmail-send", {
        body: {
          to: email,
          subject: `Invoice #${invoiceNumber} - ${fmt(total)} - Rebar.Shop`,
          body: emailBody,
        },
      });
      if (error) throw error;

      // Update invoice status to sent
      await supabase.from("sales_invoices").update({ status: "sent" }).eq("id", invoiceId);
      setStatus("sent");
      queryClient.invalidateQueries({ queryKey: ["sales_invoices"] });

      setEmailDialogOpen(false);
      toast({ title: "Invoice sent", description: `Email sent to ${email}` });
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8">
      {/* Email Dialog with link status warnings */}
      {emailDialogOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center print:hidden" onClick={() => setEmailDialogOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 text-gray-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Send Invoice via Email</h3>
            <label className="text-sm text-gray-600 font-medium">Recipient Email</label>
            <Input
              type="email"
              placeholder="customer@example.com"
              value={recipientEmail || customerEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className={`mt-1 mb-3 ${inputCls}`}
            />

            {/* Payment link status indicators */}
            <div className="space-y-1.5 mb-4 text-xs">
              <div className="flex items-center gap-2">
                {linkCheckStatus.stripe === null ? (
                  <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                ) : linkCheckStatus.stripe ? (
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                )}
                <span className={linkCheckStatus.stripe === false ? "text-amber-600" : "text-gray-500"}>
                  Stripe payment link {linkCheckStatus.stripe === null ? "checking…" : linkCheckStatus.stripe ? "ready" : "unavailable"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {linkCheckStatus.qb === null ? (
                  <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                ) : linkCheckStatus.qb ? (
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                )}
                <span className={linkCheckStatus.qb === false ? "text-amber-600" : "text-gray-500"}>
                  QuickBooks payment link {linkCheckStatus.qb === null ? "checking…" : linkCheckStatus.qb ? "ready" : "unavailable"}
                </span>
              </div>
            </div>

            {(linkCheckStatus.stripe === false || linkCheckStatus.qb === false) && (
              <p className="text-xs text-amber-600 mb-3 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Invoice will be sent without {linkCheckStatus.stripe === false && linkCheckStatus.qb === false ? "payment links" : linkCheckStatus.stripe === false ? "Stripe link" : "QuickBooks link"}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className={`gap-2 ${(linkCheckStatus.stripe === false || linkCheckStatus.qb === false) ? "bg-amber-600 hover:bg-amber-700" : ""}`}
              >
                {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {(linkCheckStatus.stripe === false || linkCheckStatus.qb === false) ? "Send Anyway" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Dialog */}
      {paymentDialogOpen && (
        <RecordPaymentDialog
          invoiceId={invoiceId}
          invoiceNumber={invoiceNumber}
          customerName={customerName}
          amountDue={total}
          onSuccess={() => {
            setPaymentDialogOpen(false);
            setStatus("paid");
            queryClient.invalidateQueries({ queryKey: ["sales_invoices"] });
          }}
          onClose={() => setPaymentDialogOpen(false)}
        />
      )}

      {/* Action buttons */}
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-50">
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Invoice
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="w-4 h-4" /> Print / PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleOpenEmailDialog()} className="gap-2">
          <Mail className="w-4 h-4" /> Send Email
        </Button>
        {(status === "sent" || status === "draft") && total > 0 && (
          <Button size="sm" variant="outline" onClick={() => setPaymentDialogOpen(true)} className="gap-2">
            <DollarSign className="w-4 h-4" /> Record Payment
          </Button>
        )}
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
            <h2 className="text-2xl font-black text-gray-900">Invoice #{invoiceNumber}</h2>
            <div className="mt-2 text-sm space-y-1">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-gray-500 font-medium">Invoice Date:</span>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className={`h-7 w-36 text-xs ${inputCls} print:border-none print:p-0`}
                />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-gray-500 font-medium">Due Date:</span>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
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
                <button className="flex items-center justify-between w-full h-8 px-3 text-sm font-semibold rounded-md border bg-white text-gray-900 border-gray-300 hover:border-gray-400 transition-colors text-left print:border-none print:p-0">
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
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className={`h-8 text-sm ${inputCls} print:border-none print:p-0 print:bg-transparent`}
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <span className="text-xs text-gray-500 font-medium">P.O. #</span>
                <Input
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="Purchase Order"
                  className={`h-7 text-xs ${inputCls} print:border-none print:p-0`}
                />
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">Sales Rep</span>
                <Input
                  value={salesRep}
                  onChange={(e) => setSalesRep(e.target.value)}
                  placeholder="Representative"
                  className={`h-7 text-xs ${inputCls} print:border-none print:p-0`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 font-bold text-gray-900">Description</th>
              <th className="text-center py-2 font-bold text-gray-900 w-28">Svc Date</th>
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
                  <Popover
                    open={productOpenIdx === idx}
                    onOpenChange={(open) => {
                      setProductOpenIdx(open ? idx : null);
                      if (!open) setProductSearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button className="flex items-center justify-between w-full h-8 px-2 text-xs rounded-md border bg-white text-gray-900 border-gray-300 hover:border-gray-400 transition-colors text-left print:border-none print:p-0">
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
                    type="date"
                    value={item.serviceDate || ""}
                    onChange={(e) => updateItem(idx, "serviceDate", e.target.value)}
                    className={`h-8 text-xs ${inputCls} print:border-none print:p-0 print:bg-transparent`}
                  />
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
          <p className="font-bold text-sm mb-1 text-gray-900">Memo / Notes</p>
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
