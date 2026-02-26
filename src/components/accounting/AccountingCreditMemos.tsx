import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RotateCcw, Search, ArrowUpDown, Download } from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

type SortField = "DocNumber" | "Customer" | "TxnDate" | "TotalAmt" | "RemainingCredit";
type SortDir = "asc" | "desc";

export function AccountingCreditMemos({ data }: Props) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("TxnDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const creditMemos = useMemo(() => {
    const raw = (data as any).creditMemos || [];
    return raw as Array<{
      Id: string;
      DocNumber?: string;
      CustomerRef?: { name: string; value: string };
      TxnDate?: string;
      TotalAmt: number;
      RemainingCredit?: number;
      Balance?: number;
    }>;
  }, [data]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = creditMemos
    .filter(cm =>
      (cm.DocNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (cm.CustomerRef?.name || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const m = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "DocNumber": return (a.DocNumber || "").localeCompare(b.DocNumber || "", undefined, { numeric: true }) * m;
        case "Customer": return (a.CustomerRef?.name || "").localeCompare(b.CustomerRef?.name || "") * m;
        case "TxnDate": return (new Date(a.TxnDate || 0).getTime() - new Date(b.TxnDate || 0).getTime()) * m;
        case "TotalAmt": return (a.TotalAmt - b.TotalAmt) * m;
        case "RemainingCredit": return ((a.RemainingCredit ?? a.Balance ?? 0) - (b.RemainingCredit ?? b.Balance ?? 0)) * m;
        default: return 0;
      }
    });

  const totalCredits = creditMemos.reduce((s, cm) => s + cm.TotalAmt, 0);
  const totalRemaining = creditMemos.reduce((s, cm) => s + (cm.RemainingCredit ?? cm.Balance ?? 0), 0);

  const exportCsv = () => {
    import("@e965/xlsx").then(({ utils, writeFile }) => {
      const rows = filtered.map(cm => ({
        "Credit Memo #": cm.DocNumber || "",
        Customer: cm.CustomerRef?.name || "",
        Date: cm.TxnDate || "",
        Amount: cm.TotalAmt,
        "Remaining Credit": cm.RemainingCredit ?? cm.Balance ?? 0,
      }));
      const ws = utils.json_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "CreditMemos");
      writeFile(wb, `credit_memos_${new Date().toISOString().slice(0, 10)}.csv`, { bookType: "csv" });
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
            placeholder="Search credit memos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
        <Button variant="outline" size="sm" className="h-12 gap-2" onClick={exportCsv}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-3">
            <RotateCcw className="w-6 h-6 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Credits</p>
              <p className="text-xl font-bold text-primary">{fmt(totalCredits)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="p-4 flex items-center gap-3">
            <RotateCcw className="w-6 h-6 text-warning" />
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-xl font-bold text-warning">{fmt(totalRemaining)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Credit Memos ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-lg">
              {search ? "No credit memos match your search" : "No credit memos found — sync from QuickBooks first"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead label="CM #" field="DocNumber" className="text-base" />
                  <SortHead label="Customer" field="Customer" className="text-base" />
                  <SortHead label="Date" field="TxnDate" className="text-base" />
                  <SortHead label="Amount" field="TotalAmt" className="text-base text-right" />
                  <SortHead label="Remaining" field="RemainingCredit" className="text-base text-right" />
                  <TableHead className="text-base">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((cm) => {
                  const remaining = cm.RemainingCredit ?? cm.Balance ?? 0;
                  const isFullyApplied = remaining === 0;
                  return (
                    <TableRow key={cm.Id} className="text-base">
                      <TableCell className="font-mono font-semibold">#{cm.DocNumber}</TableCell>
                      <TableCell className="font-medium">{cm.CustomerRef?.name || "—"}</TableCell>
                      <TableCell>{cm.TxnDate ? new Date(cm.TxnDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(cm.TotalAmt)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(remaining)}</TableCell>
                      <TableCell>
                        <Badge className={`border-0 text-sm ${isFullyApplied ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                          {isFullyApplied ? "Applied" : "Open"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

AccountingCreditMemos.displayName = "AccountingCreditMemos";
