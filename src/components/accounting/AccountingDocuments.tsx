import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Package, Calculator, ClipboardList, Eye, Loader2, ArrowRight, ChevronLeft, ChevronRight, Search, PenTool, Plus, FileOutput, Sparkles, ChevronDown, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";
import { InvoiceTemplate } from "./documents/InvoiceTemplate";
import { PackingSlipTemplate } from "./documents/PackingSlipTemplate";
import { QuotationTemplate } from "./documents/QuotationTemplate";
import { EstimationTemplate } from "./documents/EstimationTemplate";
import { useArchivedQuotations } from "@/hooks/useArchivedQuotations";
import { ConvertQuoteDialog } from "@/components/orders/ConvertQuoteDialog";
import { ESignatureDialog } from "@/components/accounting/ESignatureDialog";
import { DocumentUploadZone } from "@/components/accounting/DocumentUploadZone";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { GenerateQuotationDialog } from "./GenerateQuotationDialog";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
  initialDocType?: DocType;
}

type DocType = "invoice" | "packing-slip" | "quotation" | "estimation";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const STATUS_BADGE_COLORS: Record<string, string> = {
  "Draft Quotation": "bg-blue-500/10 text-blue-600 border-blue-200",
  "Quotation Sent": "bg-violet-500/10 text-violet-600 border-violet-200",
  "Sales Order": "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  "Cancelled": "bg-zinc-500/10 text-zinc-500 border-zinc-200",
};

const QUOTATION_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "Draft Quotation", label: "Draft Quotation" },
  { value: "Quotation Sent", label: "Quotation Sent" },
  { value: "Sales Order", label: "Sales Order" },
  { value: "Cancelled", label: "Cancelled" },
];

export function AccountingDocuments({ data, initialDocType }: Props) {
  const queryClient = useQueryClient();
  const [activeDoc, setActiveDoc] = useState<DocType>(initialDocType || "quotation");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [convertingQuoteId, setConvertingQuoteId] = useState<string | null>(null);

  useEffect(() => {
    if (initialDocType) {
      setActiveDoc(initialDocType);
    }
  }, [initialDocType]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<DocType | null>(null);
  const [convertQuote, setConvertQuote] = useState<{ id: string; quote_number: string; total_amount: number | null; customer_name: string } | null>(null);
  const [signQuote, setSignQuote] = useState<{ id: string; quote_number: string } | null>(null);
  const [viewQuote, setViewQuote] = useState<typeof quotations[number] | null>(null);

  // Quotation pagination & filter state
  const [qPage, setQPage] = useState(1);
  const [qSearch, setQSearch] = useState("");
  const [qSearchInput, setQSearchInput] = useState("");
  const [qStatus, setQStatus] = useState("all");

  const { quotations, isLoading: quotationsLoading, totalCount, totalPages } = useArchivedQuotations({
    page: qPage,
    pageSize: 50,
    search: qSearch,
    status: qStatus,
  });

  // Reset page when filters change
  const handleSearchSubmit = () => {
    setQSearch(qSearchInput);
    setQPage(1);
  };

  const handleStatusChange = (value: string) => {
    setQStatus(value);
    setQPage(1);
  };

  const openPreview = (type: DocType, id: string) => {
    setPreviewType(type);
    setPreviewId(id);
  };

  const closePreview = () => {
    setPreviewType(null);
    setPreviewId(null);
  };

  // Build invoice template data from QB invoice
  const getInvoiceData = (inv: typeof data.invoices[0]) => ({
    invoiceNumber: inv.DocNumber,
    invoiceDate: new Date(inv.TxnDate).toLocaleDateString(),
    dueDate: new Date(inv.DueDate).toLocaleDateString(),
    customerName: inv.CustomerRef?.name || "Unknown",
    items: [{
      description: "Rebar Fabrication & Supply",
      quantity: 1,
      unitPrice: inv.TotalAmt,
      taxes: "HST ON-sale",
      amount: inv.TotalAmt,
    }],
    untaxedAmount: inv.TotalAmt,
    taxRate: 0.13,
    taxAmount: inv.TotalAmt * 0.13,
    total: inv.TotalAmt * 1.13,
    paidAmount: inv.TotalAmt - inv.Balance,
    amountDue: inv.Balance,
    paymentCommunication: inv.DocNumber,
    source: "",
    inclusions: [],
  });

  const getPackingSlipData = (inv: typeof data.invoices[0]) => ({
    invoiceNumber: inv.DocNumber,
    invoiceDate: new Date(inv.TxnDate).toLocaleDateString(),
    customerName: inv.CustomerRef?.name || "Unknown",
    items: [{
      date: new Date(inv.TxnDate).toLocaleDateString(),
      description: "Rebar Fabrication & Supply",
      quantity: `${inv.TotalAmt > 0 ? "1.00" : "0"} Units`,
    }],
    inclusions: [],
  });

  const getQuotationData = (est: typeof data.estimates[0]) => {
    const rawLines = (est as any).Line as Array<Record<string, any>> | undefined;
    const items = (rawLines || [])
      .filter((l) => l.DetailType === "SalesItemLineDetail")
      .map((l) => {
        const detail = l.SalesItemLineDetail || {};
        const qty = Number(detail.Qty || 1);
        const unitPrice = Number(detail.UnitPrice || l.Amount || 0);
        return {
          description: (l.Description as string) || detail?.ItemRef?.name || "Line item",
          quantity: qty,
          unitPrice,
          amount: Number(l.Amount || qty * unitPrice),
        };
      });

    // Fallback: if no parsed line items, show a single summary row
    const finalItems = items.length > 0 ? items : [{
      description: "Rebar Fabrication & Supply",
      quantity: 1,
      unitPrice: est.TotalAmt,
      amount: est.TotalAmt,
    }];

    const untaxed = finalItems.reduce((s, i) => s + i.amount, 0);

    return {
      quoteNumber: est.DocNumber,
      quoteDate: new Date(est.TxnDate).toLocaleDateString(),
      expirationDate: new Date(est.ExpirationDate).toLocaleDateString(),
      customerName: est.CustomerRef?.name || "Unknown",
      items: finalItems,
      untaxedAmount: untaxed,
      taxRate: 0.13,
      taxAmount: untaxed * 0.13,
      total: untaxed * 1.13,
      inclusions: [],
      exclusions: [],
      terms: [
        "Payment due within 30 days of invoice date.",
        "Prices valid for the duration specified above.",
        "All amounts in CAD.",
        "HST 13% applied where applicable.",
      ],
    };
  };

  const getEstimationData = (est: typeof data.estimates[0]) => ({
    estimateNumber: est.DocNumber,
    estimateDate: new Date(est.TxnDate).toLocaleDateString(),
    validUntil: new Date(est.ExpirationDate).toLocaleDateString(),
    customerName: est.CustomerRef?.name || "Unknown",
    projectName: `Project ${est.DocNumber}`,
    sections: [{
      title: "Rebar Supply & Fabrication",
      items: [{
        description: "Heavy/Light Bend Fabricated Rebar",
        quantity: 1,
        unit: "Lot",
        unitPrice: est.TotalAmt,
        amount: est.TotalAmt,
      }],
    }],
    subtotal: est.TotalAmt,
    taxRate: 0.13,
    taxAmount: est.TotalAmt * 0.13,
    total: est.TotalAmt * 1.13,
    notes: ["Subject to final measurements on site."],
    assumptions: ["Standard access for delivery truck at site."],
  });

  const docTabs: { id: DocType; label: string; icon: typeof Package; count: number }[] = [];

  const handleCreateInvoiceFromQuote = async (quoteId: string) => {
    setConvertingQuoteId(quoteId);
    try {
      const { data: result, error } = await supabase.functions.invoke("qb-sync-engine", {
        body: { action: "convert-estimate-to-invoice", estimate_id: quoteId },
      });
      if (error) throw error;
      toast({ title: "Invoice created", description: "Quotation converted to invoice successfully." });
      data.loadAll?.();
    } catch (err: any) {
      toast({ title: "Conversion failed", description: err?.message || "Could not convert quotation to invoice.", variant: "destructive" });
    } finally {
      setConvertingQuoteId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Doc type tabs */}
      <div className="flex gap-2 flex-wrap items-center">
        {docTabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeDoc === tab.id ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setActiveDoc(tab.id)}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <Badge variant="secondary" className="ml-1 text-xs">{tab.count}</Badge>
          </Button>
        ))}
        <div className="ml-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="w-4 h-4" /> Add Quotation <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => {
                const zone = document.querySelector('[data-upload-zone="quotation"]');
                if (zone) zone.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const input = zone?.querySelector('input[type="file"]') as HTMLInputElement;
                if (input) input.click();
              }}>
                <Upload className="w-4 h-4 mr-2" /> Manual Upload
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowGenerateDialog(true)}>
                <Sparkles className="w-4 h-4 mr-2" /> AI Auto (from Estimation)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quotation filters & search */}
      {activeDoc === "quotation" && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quote # or salesperson…"
              value={qSearchInput}
              onChange={(e) => setQSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
              className="pl-9 h-9"
            />
          </div>
          <Select value={qStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUOTATION_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {totalCount.toLocaleString()} quotations
            {quotationsLoading && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />}
          </span>
        </div>
      )}

      {/* Quotation upload zone */}
      {activeDoc === "quotation" && (
        <div data-upload-zone="quotation">
          <DocumentUploadZone
            targetType="estimate"
            onImport={(result) => {
              const quoteNum = result.fields.find(f => f.field === "quote_number")?.value;
              toast({ title: "Quotation imported", description: quoteNum ? `Quote ${quoteNum} imported successfully.` : `${result.documentType} with ${result.fields.length} fields extracted.` });
              queryClient.invalidateQueries({ queryKey: ["archived-quotations"] });
            }}
          />
        </div>
      )}

      {/* Document list */}
      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="space-y-2">
          {(activeDoc === "invoice" || activeDoc === "packing-slip") && data.invoices.map((inv) => (
            <Card key={`${activeDoc}-${inv.Id}`} className="hover:ring-2 hover:ring-primary/20 transition-all">
              <CardContent className={`flex items-center justify-between ${activeDoc === "packing-slip" ? "p-3" : "p-4"}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                    {activeDoc === "invoice" ? <FileText className="w-4 h-4 text-primary" /> : <Package className="w-4 h-4 text-primary" />}
                  </div>
                  {activeDoc === "packing-slip" ? (
                    <p className="text-sm font-medium truncate">
                      #{inv.DocNumber} — {inv.CustomerRef?.name} · {new Date(inv.TxnDate).toLocaleDateString()} · {fmt(inv.TotalAmt)}
                    </p>
                  ) : (
                    <div>
                      <p className="font-semibold">#{inv.DocNumber} — {inv.CustomerRef?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(inv.TxnDate).toLocaleDateString()} · {fmt(inv.TotalAmt)}
                        {inv.Balance > 0 && <span className="text-destructive ml-2">Due: {fmt(inv.Balance)}</span>}
                      </p>
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={() => openPreview(activeDoc, inv.Id)}
                >
                  <Eye className="w-3.5 h-3.5" /> View
                </Button>
              </CardContent>
            </Card>
          ))}

          {activeDoc === "quotation" && quotations.length > 0 && quotations.map((q) => {
            const customer = (q.metadata as Record<string, unknown>)?.odoo_customer as string || "Unknown";
            const isSale = q.odoo_status === "Sales Order";
            return (
              <Card key={q.id} className="hover:ring-2 hover:ring-primary/20 transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <ClipboardList className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{q.quote_number} — {customer}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(q.created_at).toLocaleDateString()} · {fmt(Number(q.total_amount) || 0)}
                        {q.salesperson && <span className="ml-2 text-muted-foreground">· {q.salesperson}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!q.signature_data && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={(e) => { e.stopPropagation(); setSignQuote({ id: q.id, quote_number: q.quote_number }); }}
                      >
                        <PenTool className="w-3.5 h-3.5" /> Sign
                      </Button>
                    )}
                    {q.signature_data && (
                      <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200">
                        ✓ Signed
                      </Badge>
                    )}
                    {isSale && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          disabled={convertingQuoteId === q.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateInvoiceFromQuote(q.id);
                          }}
                        >
                          {convertingQuoteId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileOutput className="w-3.5 h-3.5" />}
                          → Create Invoice
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConvertQuote({
                              id: q.id,
                              quote_number: q.quote_number,
                              total_amount: q.total_amount,
                              customer_name: customer,
                            });
                          }}
                        >
                          <ArrowRight className="w-3.5 h-3.5" /> Convert to Order
                        </Button>
                      </>
                    )}
                    <Badge variant="outline" className={`text-xs ${STATUS_BADGE_COLORS[q.odoo_status || ""] || ""}`}>
                      {q.odoo_status || q.status}
                    </Badge>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); setViewQuote(q); }}>
                      <Eye className="w-3.5 h-3.5" /> View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {activeDoc === "quotation" && quotations.length === 0 && !quotationsLoading && data.estimates.map((est) => (
            <Card key={`quotation-${est.Id}`} className="hover:ring-2 hover:ring-primary/20 transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ClipboardList className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">#{est.DocNumber} — {est.CustomerRef?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(est.TxnDate).toLocaleDateString()} · {fmt(est.TotalAmt)}
                      <Badge variant="outline" className="ml-2 text-xs">{est.TxnStatus}</Badge>
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openPreview("quotation", est.Id)}>
                  <Eye className="w-3.5 h-3.5" /> View
                </Button>
              </CardContent>
            </Card>
          ))}

          {activeDoc === "estimation" && data.estimates.map((est) => (
            <Card key={`estimation-${est.Id}`} className="hover:ring-2 hover:ring-primary/20 transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calculator className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">#{est.DocNumber} — {est.CustomerRef?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(est.TxnDate).toLocaleDateString()} · {fmt(est.TotalAmt)}
                      <Badge variant="outline" className="ml-2 text-xs">{est.TxnStatus}</Badge>
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openPreview("estimation", est.Id)}>
                  <Eye className="w-3.5 h-3.5" /> View
                </Button>
              </CardContent>
            </Card>
          ))}

          {((activeDoc === "invoice" || activeDoc === "packing-slip") && data.invoices.length === 0) && (
            <p className="text-center text-muted-foreground py-12">No invoices found. Sync from QuickBooks first.</p>
          )}
          {activeDoc === "quotation" && quotations.length === 0 && !quotationsLoading && totalCount === 0 && data.estimates.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No quotations found.</p>
          )}
          {activeDoc === "estimation" && data.estimates.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No estimates found. Sync from QuickBooks first.</p>
          )}
        </div>
      </ScrollArea>

      {/* Quotation pagination controls */}
      {activeDoc === "quotation" && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            disabled={qPage <= 1}
            onClick={() => setQPage((p) => Math.max(1, p - 1))}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {qPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={qPage >= totalPages}
            onClick={() => setQPage((p) => Math.min(totalPages, p + 1))}
            className="gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Preview overlays */}
      {previewType === "invoice" && previewId && (() => {
        const inv = data.invoices.find(i => i.Id === previewId);
        return inv ? <InvoiceTemplate data={getInvoiceData(inv)} onClose={closePreview} /> : null;
      })()}

      {previewType === "packing-slip" && previewId && (() => {
        const inv = data.invoices.find(i => i.Id === previewId);
        return inv ? <PackingSlipTemplate data={getPackingSlipData(inv)} onClose={closePreview} /> : null;
      })()}

      {previewType === "quotation" && previewId && (() => {
        const est = data.estimates.find(e => e.Id === previewId);
        return est ? <QuotationTemplate data={getQuotationData(est)} onClose={closePreview} /> : null;
      })()}

      {previewType === "estimation" && previewId && (() => {
        const est = data.estimates.find(e => e.Id === previewId);
        return est ? <EstimationTemplate data={getEstimationData(est)} onClose={closePreview} /> : null;
      })()}

      {/* Convert Quote Dialog */}
      {convertQuote && (
        <ConvertQuoteDialog
          open={!!convertQuote}
          onOpenChange={(open) => !open && setConvertQuote(null)}
          quote={convertQuote}
        />
      )}

      {/* eSignature Dialog */}
      {signQuote && (
        <ESignatureDialog
          open={!!signQuote}
          onOpenChange={(open) => !open && setSignQuote(null)}
          quoteId={signQuote.id}
          quoteNumber={signQuote.quote_number}
          onSigned={() => { setSignQuote(null); }}
        />
      )}
      {/* Quotation Document Overlay */}
      {viewQuote && (() => {
        const meta = viewQuote.metadata as Record<string, unknown> | null;
        const lines = ((meta?.order_lines || meta?.line_items) as Array<Record<string, unknown>>) || [];
        const parsedItems = lines.map((l) => {
          const quantity = Number(l.product_uom_qty || l.quantity || 1);
          const unitPrice = Number(l.price_unit || l.unit_price || 0);
          return {
            description: String(l.name || l.description || "Item"),
            quantity,
            unitPrice,
            amount: quantity * unitPrice,
          };
        });
        // Fallback: if no line items were synced, show a single summary row
        const items = parsedItems.length > 0 ? parsedItems : [{
          description: "Rebar Fabrication & Supply",
          quantity: 1,
          unitPrice: Number(viewQuote.total_amount || 0),
          amount: Number(viewQuote.total_amount || 0),
        }];
        const untaxed = items.reduce((s, i) => s + i.amount, 0);
        const customerAddress = (meta?.odoo_partner_address as string) || (meta?.customer_address as string) || undefined;
        const projectName = (meta?.odoo_project as string) || (meta?.project_name as string) || viewQuote.quote_number;
        return (
          <QuotationTemplate
            data={{
              quoteNumber: viewQuote.quote_number,
              quoteDate: new Date(viewQuote.created_at).toLocaleDateString(),
              expirationDate: viewQuote.valid_until
                ? new Date(viewQuote.valid_until).toLocaleDateString()
                : "—",
              customerName: (meta?.odoo_customer as string) || viewQuote.salesperson || "Unknown",
              customerAddress,
              projectName,
              items,
              untaxedAmount: untaxed,
              taxRate: 0.13,
              taxAmount: untaxed * 0.13,
              total: untaxed * 1.13,
              terms: [
                "Payment due within 30 days of invoice date.",
                "Prices valid for the duration specified above.",
                "All amounts in CAD.",
                "HST 13% applied where applicable.",
              ],
            }}
            onClose={() => setViewQuote(null)}
          />
        );
      })()}
      <GenerateQuotationDialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog} />
    </div>
  );
}
