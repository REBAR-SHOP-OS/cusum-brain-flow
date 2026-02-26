import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileCheck, Search, Send, FileText, ArrowUpDown, Download, Loader2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CustomerSelectDialog } from "./CustomerSelectDialog";
import { CreateTransactionDialog } from "@/components/customers/CreateTransactionDialog";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

type SortField = "DocNumber" | "Customer" | "TxnDate" | "ExpirationDate" | "TotalAmt" | "Status";
type SortDir = "asc" | "desc";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const statusColors: Record<string, string> = {
  Pending: "bg-warning/10 text-warning",
  Accepted: "bg-success/10 text-success",
  Closed: "bg-muted text-muted-foreground",
  Rejected: "bg-destructive/10 text-destructive",
  Converted: "bg-primary/10 text-primary",
};

export function AccountingEstimates({ data }: Props) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("DocNumber");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [converting, setConverting] = useState<string | null>(null);
  const [customerSelectOpen, setCustomerSelectOpen] = useState(false);
  const [txnCustomer, setTxnCustomer] = useState<{ qbId: string; name: string } | null>(null);

  // Pull estimates from the accounting mirror data if available
  const estimates = useMemo(() => {
    // Try to find estimates from qb data - they may be in a generic "estimates" array or accounting_mirror
    const raw = (data as any).estimates || [];
    return raw as Array<{
      Id: string;
      DocNumber?: string;
      CustomerRef?: { name: string; value: string };
      TxnDate?: string;
      ExpirationDate?: string;
      TotalAmt: number;
      TxnStatus?: string;
      SyncToken?: string;
    }>;
  }, [data]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = estimates
    .filter(e =>
      (e.DocNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.CustomerRef?.name || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const m = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "DocNumber": return (a.DocNumber || "").localeCompare(b.DocNumber || "", undefined, { numeric: true }) * m;
        case "Customer": return (a.CustomerRef?.name || "").localeCompare(b.CustomerRef?.name || "") * m;
        case "TxnDate": return (new Date(a.TxnDate || 0).getTime() - new Date(b.TxnDate || 0).getTime()) * m;
        case "ExpirationDate": return (new Date(a.ExpirationDate || 0).getTime() - new Date(b.ExpirationDate || 0).getTime()) * m;
        case "TotalAmt": return (a.TotalAmt - b.TotalAmt) * m;
        case "Status": return (a.TxnStatus || "").localeCompare(b.TxnStatus || "") * m;
        default: return 0;
      }
    });

  const convertToInvoice = async (estimateId: string) => {
    setConverting(estimateId);
    try {
      const { error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "convert-estimate", estimateId },
      });
      if (error) throw error;
      toast({ title: "Estimate converted to invoice successfully" });
      data.loadAll();
    } catch (err: any) {
      toast({ title: "Convert failed", description: err?.message || "Unknown error", variant: "destructive" });
    } finally {
      setConverting(null);
    }
  };

  const exportCsv = () => {
    import("@e965/xlsx").then(({ utils, writeFile }) => {
      const rows = filtered.map(e => ({
        "Estimate #": e.DocNumber || "",
        Customer: e.CustomerRef?.name || "",
        Date: e.TxnDate || "",
        Expiry: e.ExpirationDate || "",
        Amount: e.TotalAmt,
        Status: e.TxnStatus || "Pending",
      }));
      const ws = utils.json_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Estimates");
      writeFile(wb, `estimates_${new Date().toISOString().slice(0, 10)}.csv`, { bookType: "csv" });
    });
  };

  function SortHead({ label, field, className }: { label: string; field: SortField; className?: string }) {
    return (
      <TableHead className={className}>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort(field)}>
          {label}
          <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-foreground" : "text-muted-foreground/50"}`} />
        </button>
      </TableHead>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search estimates by number or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
        <Button variant="outline" size="sm" className="h-12 gap-2" onClick={exportCsv}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
        <Button size="sm" className="h-12 gap-2" onClick={() => setCustomerSelectOpen(true)}>
          <Plus className="w-4 h-4" /> Create Quotation
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {["Pending", "Accepted", "Rejected", "Closed"].map(status => (
          <Card key={status} className={statusColors[status]?.replace("text-", "bg-").split(" ")[0] || "bg-muted/5"}>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">{status}</p>
              <p className="text-2xl font-bold">{estimates.filter(e => (e.TxnStatus || "Pending") === status).length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="w-5 h-5" />
            Estimates ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-lg">
              {search ? "No estimates match your search" : "No estimates found — sync from QuickBooks first"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead label="Estimate #" field="DocNumber" className="text-base" />
                  <SortHead label="Customer" field="Customer" className="text-base" />
                  <SortHead label="Date" field="TxnDate" className="text-base" />
                  <SortHead label="Expiry" field="ExpirationDate" className="text-base" />
                  <SortHead label="Amount" field="TotalAmt" className="text-base text-right" />
                  <SortHead label="Status" field="Status" className="text-base" />
                  <TableHead className="text-base text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((est) => {
                  const status = est.TxnStatus || "Pending";
                  const color = statusColors[status] || "bg-muted text-muted-foreground";
                  return (
                    <TableRow key={est.Id} className="text-base">
                      <TableCell className="font-mono font-semibold">#{est.DocNumber}</TableCell>
                      <TableCell className="font-medium">{est.CustomerRef?.name || "—"}</TableCell>
                      <TableCell>{est.TxnDate ? new Date(est.TxnDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{est.ExpirationDate ? new Date(est.ExpirationDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(est.TotalAmt)}</TableCell>
                      <TableCell>
                        <Badge className={`${color} border-0 text-sm`}>{status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {status === "Pending" || status === "Accepted" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 gap-1"
                              disabled={converting === est.Id}
                              onClick={() => convertToInvoice(est.Id)}
                            >
                              {converting === est.Id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileText className="w-4 h-4" />
                              )}
                              Convert
                            </Button>
                          ) : null}
                          <Button size="sm" variant="ghost" className="h-9 gap-1">
                            <Send className="w-4 h-4" /> Send
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <CustomerSelectDialog
        open={customerSelectOpen}
        onOpenChange={setCustomerSelectOpen}
        customers={((data as any).customers || []).map((c: any) => ({
          Id: c.qb_customer_id || c.Id,
          DisplayName: c.display_name || c.DisplayName,
          CompanyName: c.CompanyName,
        }))}
        onSelect={(qbId, name) => setTxnCustomer({ qbId, name })}
      />

      {txnCustomer && (
        <CreateTransactionDialog
          open={!!txnCustomer}
          onOpenChange={(open) => { if (!open) setTxnCustomer(null); }}
          type="Estimate"
          customerQbId={txnCustomer.qbId}
          customerName={txnCustomer.name}
          onCreated={() => { setTxnCustomer(null); data.loadAll(); }}
        />
      )}
    </div>
  );
}

AccountingEstimates.displayName = "AccountingEstimates";
