import { useState } from "react";
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
import { FileText, Package, Calculator, ClipboardList, Eye, Loader2, ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";
import { InvoiceTemplate } from "./documents/InvoiceTemplate";
import { PackingSlipTemplate } from "./documents/PackingSlipTemplate";
import { QuotationTemplate } from "./documents/QuotationTemplate";
import { EstimationTemplate } from "./documents/EstimationTemplate";
import { useArchivedQuotations } from "@/hooks/useArchivedQuotations";
import { ConvertQuoteDialog } from "@/components/orders/ConvertQuoteDialog";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
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

export function AccountingDocuments({ data }: Props) {
  const [activeDoc, setActiveDoc] = useState<DocType>("quotation");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<DocType | null>(null);
  const [convertQuote, setConvertQuote] = useState<{ id: string; quote_number: string; total_amount: number | null; customer_name: string } | null>(null);

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

  const getQuotationData = (est: typeof data.estimates[0]) => ({
    quoteNumber: est.DocNumber,
    quoteDate: new Date(est.TxnDate).toLocaleDateString(),
    expirationDate: new Date(est.ExpirationDate).toLocaleDateString(),
    customerName: est.CustomerRef?.name || "Unknown",
    items: [{
      description: "Rebar Fabrication & Supply",
      quantity: 1,
      unitPrice: est.TotalAmt,
      amount: est.TotalAmt,
    }],
    untaxedAmount: est.TotalAmt,
    taxRate: 0.13,
    taxAmount: est.TotalAmt * 0.13,
    total: est.TotalAmt * 1.13,
    inclusions: [],
    exclusions: [],
    terms: [
      "Quote valid for 30 days from date of issue.",
      "Shop drawings required prior to fabrication.",
      "One (1) shop drawing revision included. Additional revisions billable via Change Order.",
      "Revisions impacting quantities, bar sizes, coatings, or scope are re-priced regardless of count.",
      "Delivery charges apply based on distance.",
    ],
  });

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

  const docTabs = [
    { id: "invoice" as DocType, label: "Invoices", icon: FileText, count: data.invoices.length },
    { id: "packing-slip" as DocType, label: "Packing Slips", icon: Package, count: data.invoices.length },
    { id: "quotation" as DocType, label: "Quotations", icon: ClipboardList, count: totalCount || data.estimates.length },
    { id: "estimation" as DocType, label: "Estimations", icon: Calculator, count: data.estimates.length },
  ];

  return (
    <div className="space-y-4">
      {/* Doc type tabs */}
      <div className="flex gap-2 flex-wrap">
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

      {/* Document list */}
      <ScrollArea className="h-[calc(100vh-320px)]">
        <div className="space-y-2">
          {(activeDoc === "invoice" || activeDoc === "packing-slip") && data.invoices.map((inv) => (
            <Card key={`${activeDoc}-${inv.Id}`} className="hover:ring-2 hover:ring-primary/20 transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    {activeDoc === "invoice" ? <FileText className="w-5 h-5 text-primary" /> : <Package className="w-5 h-5 text-primary" />}
                  </div>
                  <div>
                    <p className="font-semibold">#{inv.DocNumber} — {inv.CustomerRef?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(inv.TxnDate).toLocaleDateString()} · {fmt(inv.TotalAmt)}
                      {inv.Balance > 0 && <span className="text-destructive ml-2">Due: {fmt(inv.Balance)}</span>}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
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
                    {isSale && (
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
                    )}
                    <Badge variant="outline" className={`text-xs ${STATUS_BADGE_COLORS[q.odoo_status || ""] || ""}`}>
                      {q.odoo_status || q.status}
                    </Badge>
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
    </div>
  );
}
