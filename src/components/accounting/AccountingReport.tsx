import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BarChart3, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { format, startOfYear } from "date-fns";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
  report: "balance-sheet" | "profit-loss" | "cash-flow";
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// QB Report row parser
interface QBReportRow {
  type: string; // "Section", "Data", "Total" (or absent)
  label: string;
  value: number | null;
  children: QBReportRow[];
  isTotal?: boolean;
  isSummary?: boolean;
}

function parseQBRows(rows: unknown[]): QBReportRow[] {
  if (!rows || !Array.isArray(rows)) return [];

  return rows.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    const header = r.Header as Record<string, unknown> | undefined;
    const summary = r.Summary as Record<string, unknown> | undefined;
    const colData = r.ColData as Array<{ value: string }> | undefined;
    const childRows = r.Rows as Record<string, unknown> | undefined;

    // Section row (has Header + Rows + Summary)
    if (header) {
      const headerCols = header.ColData as Array<{ value: string }> | undefined;
      const summaryCols = summary?.ColData as Array<{ value: string }> | undefined;
      const children = childRows?.Row ? parseQBRows(childRows.Row as unknown[]) : [];

      return {
        type: "Section",
        label: headerCols?.[0]?.value || "",
        value: null,
        children,
        isSummary: false,
      };
    }

    // Data row (has ColData directly)
    if (colData) {
      const rtype = r.type as string | undefined;
      return {
        type: rtype === "Section" ? "Section" : "Data",
        label: colData[0]?.value || "",
        value: colData.length > 1 ? parseFloat(colData[colData.length - 1]?.value || "0") || 0 : null,
        children: [],
        isTotal: false,
      };
    }

    return { type: "Data", label: "", value: null, children: [] };
  });
}

function ReportSection({ rows, depth = 0 }: { rows: QBReportRow[]; depth?: number }) {
  return (
    <>
      {rows.map((row, i) => {
        if (row.type === "Section" && row.children.length > 0) {
          return <CollapsibleSection key={`${row.label}-${i}`} row={row} depth={depth} />;
        }

        const isTotal = row.label.toLowerCase().startsWith("total ") || row.label.toLowerCase().startsWith("net ");
        return (
          <TableRow key={`${row.label}-${i}`} className={isTotal ? "bg-muted/30 font-bold" : ""}>
            <TableCell style={{ paddingLeft: `${16 + depth * 20}px` }} className="text-sm">
              {row.label}
            </TableCell>
            <TableCell className="text-right text-sm font-semibold">
              {row.value != null ? fmt(row.value) : ""}
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

function CollapsibleSection({ row, depth }: { row: QBReportRow; depth: number }) {
  const [open, setOpen] = useState(true);

  // Find total row in children
  const totalRow = row.children.find((c) => c.label.toLowerCase().startsWith("total "));
  const totalValue = totalRow?.value;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <TableRow className="bg-muted/20">
        <TableCell style={{ paddingLeft: `${16 + depth * 20}px` }} className="text-sm font-semibold">
          <CollapsibleTrigger className="flex items-center gap-1 hover:text-primary cursor-pointer">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {row.label}
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="text-right text-sm font-semibold">
          {!open && totalValue != null ? fmt(totalValue) : ""}
        </TableCell>
      </TableRow>
      <CollapsibleContent>
        <ReportSection rows={row.children} depth={depth + 1} />
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AccountingReport({ data, report }: Props) {
  const { qbAction, totalReceivable, totalPayable, bills, payments } = data;

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<QBReportRow[] | null>(null);
  const [reportTitle, setReportTitle] = useState("");

  // Date controls
  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const titles: Record<string, string> = {
    "balance-sheet": "Balance Sheet",
    "profit-loss": "Profit and Loss",
    "cash-flow": "Cash Flow Statement",
  };

  const runReport = useCallback(async () => {
    setLoading(true);
    setReportData(null);
    try {
      let result: Record<string, unknown>;

      if (report === "profit-loss") {
        result = await qbAction("get-profit-loss", { startDate, endDate });
      } else if (report === "balance-sheet") {
        result = await qbAction("get-balance-sheet", { asOfDate });
      } else {
        // Cash flow — derive from existing data (no native QB API)
        const totalPayments = payments.reduce((s, p) => s + p.TotalAmt, 0);
        const totalBilled = bills.reduce((s, b) => s + b.TotalAmt, 0);
        setReportData([
          { type: "Data", label: "Cash Received (Payments)", value: totalPayments, children: [] },
          { type: "Data", label: "Cash Paid Out (Bills - AP)", value: -(totalBilled - totalPayable), children: [] },
          { type: "Data", label: "Outstanding Receivable", value: totalReceivable, children: [] },
          { type: "Data", label: "Net Cash Position", value: totalPayments - (totalBilled - totalPayable), children: [], isTotal: true },
        ]);
        setReportTitle("Cash Flow Statement");
        setLoading(false);
        return;
      }

      // Parse QB report response
      const reportObj = (result as Record<string, unknown>).report || result;
      const rows = (reportObj as Record<string, unknown>)?.Rows as Record<string, unknown> | undefined;
      const headerData = (reportObj as Record<string, unknown>)?.Header as Record<string, unknown> | undefined;
      setReportTitle(headerData?.ReportName as string || titles[report]);

      if (rows?.Row) {
        setReportData(parseQBRows(rows.Row as unknown[]));
      } else {
        setReportData([]);
      }
    } catch (err) {
      console.error("Report fetch failed:", err);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [report, qbAction, startDate, endDate, asOfDate, payments, bills, totalPayable, totalReceivable]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          {titles[report]}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Live data from QuickBooks · {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* Date controls + Run */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-4 flex-wrap">
            {report === "balance-sheet" ? (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">As of Date</Label>
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="h-9 w-[180px]"
                />
              </div>
            ) : report === "profit-loss" ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 w-[180px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 w-[180px]"
                  />
                </div>
              </>
            ) : null}
            <Button onClick={runReport} disabled={loading} className="h-9 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Run Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report content */}
      {loading && (
        <Card>
          <CardContent className="p-6 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && reportData && (
        <Card>
          <CardContent className="p-0">
            {reportTitle && (
              <div className="p-4 pb-2 border-b">
                <h3 className="font-bold text-lg">{reportTitle}</h3>
                {report === "balance-sheet" && (
                  <p className="text-xs text-muted-foreground">As of {asOfDate}</p>
                )}
                {report === "profit-loss" && (
                  <p className="text-xs text-muted-foreground">{startDate} through {endDate}</p>
                )}
              </div>
            )}
            {reportData.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No data returned. Check your date range and try again.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm font-semibold">Account</TableHead>
                    <TableHead className="text-sm font-semibold text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <ReportSection rows={reportData} />
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !reportData && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="text-lg">Click "Run Report" to fetch live data from QuickBooks.</p>
            <p className="text-sm mt-1">
              {report === "cash-flow"
                ? "Cash flow is derived from synced payment and bill data."
                : "Report data is pulled directly from the QuickBooks Report API."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

AccountingReport.displayName = "AccountingReport";
