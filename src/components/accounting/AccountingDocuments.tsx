import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Package, Calculator, ClipboardList, Eye, Loader2, RefreshCw } from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";
import { InvoiceTemplate } from "./documents/InvoiceTemplate";
import { PackingSlipTemplate } from "./documents/PackingSlipTemplate";
import { QuotationTemplate } from "./documents/QuotationTemplate";
import { EstimationTemplate } from "./documents/EstimationTemplate";
import { useOdooQuotations } from "@/hooks/useOdooQuotations";

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

export function AccountingDocuments({ data }: Props) {
  const [activeDoc, setActiveDoc] = useState<DocType>("quotation");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<DocType | null>(null);
  const { quotations, isLoading: quotationsLoading, isSyncing, syncQuotations } = useOdooQuotations();

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

  // Build packing slip from invoice
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

  // Build quotation from estimate
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
      "One revision included at no extra charge.",
      "Delivery charges apply based on distance.",
    ],
  });

  // Build estimation from estimate (more detailed)
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
    { id: "quotation" as DocType, label: "Quotations", icon: ClipboardList, count: quotations.length || data.estimates.length },
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

      {/* Sync button for quotations */}
      {activeDoc === "quotation" && (
        <div className="flex items-center gap-2">
          <Button onClick={syncQuotations} size="sm" variant="outline" disabled={isSyncing} className="gap-2">
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Odoo Quotations
          </Button>
          {quotationsLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      )}

      {/* Document list */}
      <ScrollArea className="h-[calc(100vh-280px)]">
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

          {activeDoc === "quotation" && quotations.length > 0 && quotations.map((q) => (
            <Card key={q.id} className="hover:ring-2 hover:ring-primary/20 transition-all">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ClipboardList className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{q.quote_number} — {(q.metadata as Record<string, unknown>)?.odoo_customer as string || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(q.created_at).toLocaleDateString()} · {fmt(Number(q.total_amount) || 0)}
                      {q.salesperson && <span className="ml-2 text-muted-foreground">· {q.salesperson}</span>}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={`text-xs ${STATUS_BADGE_COLORS[q.odoo_status || ""] || ""}`}>
                  {q.odoo_status || q.status}
                </Badge>
              </CardContent>
            </Card>
          ))}

          {activeDoc === "quotation" && quotations.length === 0 && data.estimates.map((est) => (
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
          {activeDoc === "quotation" && quotations.length === 0 && data.estimates.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No quotations found. Click "Sync Odoo Quotations" to import.</p>
          )}
          {activeDoc === "estimation" && data.estimates.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No estimates found. Sync from QuickBooks first.</p>
          )}
        </div>
      </ScrollArea>

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
    </div>
  );
}
