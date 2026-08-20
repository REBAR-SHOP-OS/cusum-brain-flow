import { useState, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Search, FileText, AlertCircle, Download, Eye } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";
import { DocumentUploadZone } from "./DocumentUploadZone";
import { PaymentSourceStrip } from "./PaymentSourceStrip";
import { usePaymentSources, type UnifiedPayment } from "@/hooks/usePaymentSources";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  quickbooks: { label: "QB", className: "text-success border-success/30 bg-success/10" },
  stripe: { label: "Stripe", className: "text-purple-500 border-purple-400/30 bg-purple-500/10" },
  bmo: { label: "BMO", className: "text-blue-500 border-blue-400/30 bg-blue-500/10" },
  odoo: { label: "Odoo", className: "text-muted-foreground border-muted-foreground/30 bg-muted/50" },
};

export function AccountingPayments({ data }: Props) {
  const { payments, invoices, customers } = data;
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<UnifiedPayment | null>(null);

  const { unifiedPayments, sourceSummaries, reconciliation } = usePaymentSources(payments);

  // Build unique customer list from payments + invoices
  const customerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) {
      map.set(c.Id, c.DisplayName);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [customers]);

  // Outstanding invoices for selected customer (Balance > 0)
  const outstandingInvoices = useMemo(() => {
    if (selectedCustomerId === "all") return [];
    return invoices.filter(
      (inv) => inv.Balance > 0 && inv.CustomerRef?.value === selectedCustomerId
    );
  }, [invoices, selectedCustomerId]);

  const totalOutstanding = useMemo(
    () => outstandingInvoices.reduce((sum, inv) => sum + inv.Balance, 0),
    [outstandingInvoices]
  );

  // Filter unified payments
  const filtered = useMemo(() => {
    return unifiedPayments.filter((p) => {
      const matchesSearch = p.customerName.toLowerCase().includes(search.toLowerCase());
      const matchesCustomer =
        selectedCustomerId === "all" ||
        (p.source === "quickbooks" && p.raw?.CustomerRef?.value === selectedCustomerId);
      return matchesSearch && matchesCustomer;
    });
  }, [unifiedPayments, search, selectedCustomerId]);

  const totalCollected = (selectedCustomerId === "all" ? unifiedPayments : filtered).reduce(
    (sum, p) => sum + p.amount,
    0
  );

  const exportCsv = () => {
    import("@e965/xlsx").then(({ utils, writeFile }) => {
      const rows = filtered.map((p) => ({
        Date: p.date || "",
        Customer: p.customerName,
        Amount: p.amount,
        Source: p.source,
      }));
      const ws = utils.json_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Payments");
      writeFile(wb, `payments_${new Date().toISOString().slice(0, 10)}.csv`, { bookType: "csv" });
    });
  };

  return (
    <div className="space-y-4">
      {/* Multi-Source Summary Strip */}
      <PaymentSourceStrip summaries={sourceSummaries} reconciliation={reconciliation} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search payments by customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
        <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
          <SelectTrigger className="h-12 w-[220px]">
            <SelectValue placeholder="All Customers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {customerOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-12 gap-2" onClick={exportCsv}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CreditCard className="w-6 h-6 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Total Collected</p>
              <p className="text-xl font-bold text-success">{fmt(totalCollected)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <DocumentUploadZone
        targetType="payment"
        onImport={(result) => {
          toast({ title: "Payment imported", description: `${result.fields.length} fields extracted.` });
        }}
      />

      {/* Outstanding Invoices Panel */}
      {selectedCustomerId !== "all" && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-warning" />
                Outstanding Invoices ({outstandingInvoices.length})
              </span>
              {totalOutstanding > 0 && (
                <Badge variant="outline" className="text-base px-3 py-1 text-warning border-warning/30">
                  {fmt(totalOutstanding)} outstanding
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {outstandingInvoices.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No outstanding invoices for this customer
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doc #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Open Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outstandingInvoices.map((inv) => (
                    <TableRow key={inv.Id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {inv.DocNumber || "—"}
                      </TableCell>
                      <TableCell>{new Date(inv.TxnDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{fmt(inv.TotalAmt)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-warning border-warning/30">
                          {fmt(inv.Balance)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payments ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-lg">No payments found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Date</TableHead>
                  <TableHead className="text-base">Customer</TableHead>
                  <TableHead className="text-base text-right">Amount</TableHead>
                  <TableHead className="text-base">Source</TableHead>
                  <TableHead className="text-base">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const badge = SOURCE_BADGE[p.source] ?? SOURCE_BADGE.quickbooks;
                  return (
                    <TableRow key={p.id} className="text-base">
                      <TableCell>{p.date ? new Date(p.date).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="font-medium">{p.customerName}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-base px-3 py-1 text-success border-success/30">
                          +{fmt(p.amount)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${badge.className}`}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => setSelectedPayment(p)}>
                          <Eye className="w-4 h-4" /> View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment Detail Sheet */}
      <Sheet open={!!selectedPayment} onOpenChange={(o) => { if (!o) setSelectedPayment(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Payment Details</SheetTitle>
            <SheetDescription>Full payment information</SheetDescription>
          </SheetHeader>
          {selectedPayment && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedPayment.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{selectedPayment.date ? new Date(selectedPayment.date).toLocaleDateString() : "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-semibold text-lg text-success">{fmt(selectedPayment.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Source</p>
                  <Badge variant="outline" className={SOURCE_BADGE[selectedPayment.source]?.className}>
                    {SOURCE_BADGE[selectedPayment.source]?.label}
                  </Badge>
                </div>
                {selectedPayment.source === "quickbooks" && selectedPayment.raw && (
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <p className="font-medium">
                      {selectedPayment.raw.PaymentMethodRef?.name || selectedPayment.raw.PaymentType || "—"}
                    </p>
                  </div>
                )}
                {selectedPayment.sourceRef && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Reference</p>
                    <a href={selectedPayment.sourceRef} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
                      {selectedPayment.sourceRef}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

AccountingPayments.displayName = "AccountingPayments";
