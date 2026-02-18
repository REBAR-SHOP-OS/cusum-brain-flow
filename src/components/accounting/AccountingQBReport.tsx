import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BookOpen, Scale, List, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { format, startOfYear } from "date-fns";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
  report: "general-ledger" | "trial-balance" | "transaction-list";
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const titles: Record<string, string> = {
  "general-ledger": "General Ledger",
  "trial-balance": "Trial Balance",
  "transaction-list": "Transaction List by Date",
};

const icons: Record<string, typeof BookOpen> = {
  "general-ledger": BookOpen,
  "trial-balance": Scale,
  "transaction-list": List,
};

const actions: Record<string, string> = {
  "general-ledger": "get-general-ledger",
  "trial-balance": "get-trial-balance",
  "transaction-list": "get-transaction-list",
};

interface ReportRow {
  type: string;
  label: string;
  values: string[];
  children: ReportRow[];
}

function parseGenericReport(report: Record<string, unknown>): { columns: string[]; rows: ReportRow[] } {
  const columns: string[] = [];
  const colDefs = (report?.Columns as any)?.Column || [];
  for (const col of colDefs) columns.push(col.ColTitle || "");

  function parseRows(rowArr: any[]): ReportRow[] {
    if (!rowArr) return [];
    return rowArr.map((r: any) => {
      if (r.Header) {
        const headerCols = r.Header.ColData || [];
        const label = headerCols[0]?.value || "";
        const children = parseRows(r.Rows?.Row || []);
        // Include summary as a child if it exists
        if (r.Summary?.ColData) {
          const sumVals = r.Summary.ColData.map((c: any) => c.value || "");
          children.push({ type: "Total", label: sumVals[0] || `Total ${label}`, values: sumVals.slice(1), children: [] });
        }
        return { type: "Section", label, values: headerCols.slice(1).map((c: any) => c.value || ""), children };
      }
      if (r.ColData) {
        const vals = r.ColData.map((c: any) => c.value || "");
        return { type: "Data", label: vals[0] || "", values: vals.slice(1), children: [] };
      }
      return { type: "Data", label: "", values: [], children: [] };
    });
  }

  const rows = parseRows((report?.Rows as any)?.Row || []);
  return { columns, rows };
}

function GenericReportSection({ rows, columns, depth = 0 }: { rows: ReportRow[]; columns: string[]; depth?: number }) {
  return (
    <>
      {rows.map((row, i) => {
        if (row.type === "Section" && row.children.length > 0) {
          return <CollapsibleReportRow key={`${row.label}-${i}`} row={row} columns={columns} depth={depth} />;
        }
        const isTotal = row.type === "Total" || row.label.toLowerCase().startsWith("total") || row.label.toLowerCase().startsWith("net ");
        return (
          <TableRow key={`${row.label}-${i}`} className={isTotal ? "bg-muted/30 font-bold" : ""}>
            <TableCell style={{ paddingLeft: `${16 + depth * 20}px` }} className="text-sm">{row.label}</TableCell>
            {row.values.map((v, vi) => (
              <TableCell key={vi} className="text-right text-sm">{v}</TableCell>
            ))}
            {/* Pad missing columns */}
            {Array.from({ length: Math.max(0, columns.length - 1 - row.values.length) }).map((_, pi) => (
              <TableCell key={`pad-${pi}`} />
            ))}
          </TableRow>
        );
      })}
    </>
  );
}

function CollapsibleReportRow({ row, columns, depth }: { row: ReportRow; columns: string[]; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <TableRow className="bg-muted/20">
        <TableCell style={{ paddingLeft: `${16 + depth * 20}px` }} className="text-sm font-semibold">
          <CollapsibleTrigger className="flex items-center gap-1 hover:text-primary cursor-pointer">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {row.label}
          </CollapsibleTrigger>
        </TableCell>
        {row.values.map((v, vi) => (
          <TableCell key={vi} className="text-right text-sm font-semibold">{!open ? v : ""}</TableCell>
        ))}
        {Array.from({ length: Math.max(0, columns.length - 1 - row.values.length) }).map((_, pi) => (
          <TableCell key={`pad-${pi}`} />
        ))}
      </TableRow>
      <CollapsibleContent>
        <GenericReportSection rows={row.children} columns={columns} depth={depth + 1} />
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AccountingQBReport({ data, report }: Props) {
  const { qbAction } = data;
  const [loading, setLoading] = useState(false);
  const [reportResult, setReportResult] = useState<{ columns: string[]; rows: ReportRow[] } | null>(null);
  const [reportTitle, setReportTitle] = useState("");

  const [startDate, setStartDate] = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const useDateRange = report !== "trial-balance";
  const Icon = icons[report];

  const runReport = useCallback(async () => {
    setLoading(true);
    setReportResult(null);
    try {
      const params = useDateRange ? { startDate, endDate } : { asOfDate };
      const result = await qbAction(actions[report], params);
      const reportObj = result?.report || result;
      const header = reportObj?.Header as Record<string, unknown> | undefined;
      setReportTitle(header?.ReportName as string || titles[report]);
      setReportResult(parseGenericReport(reportObj));
    } catch (err) {
      console.error(`${titles[report]} fetch failed:`, err);
      setReportResult({ columns: [], rows: [] });
    } finally {
      setLoading(false);
    }
  }, [qbAction, report, startDate, endDate, asOfDate, useDateRange]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Icon className="w-6 h-6 text-primary" />
          {titles[report]}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Live data from QuickBooks · {new Date().toLocaleDateString()}</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-4 flex-wrap">
            {useDateRange ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-[180px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-[180px]" />
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">As of Date</Label>
                <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="h-9 w-[180px]" />
              </div>
            )}
            <Button onClick={runReport} disabled={loading} className="h-9 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Run Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card><CardContent className="p-6 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </CardContent></Card>
      )}

      {!loading && reportResult && (
        <Card>
          <CardContent className="p-0">
            {reportTitle && (
              <div className="p-4 pb-2 border-b">
                <h3 className="font-bold text-lg">{reportTitle}</h3>
                <p className="text-xs text-muted-foreground">
                  {useDateRange ? `${startDate} through ${endDate}` : `As of ${asOfDate}`}
                </p>
              </div>
            )}
            {reportResult.rows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No data returned. Check your date range.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {reportResult.columns.map((col, i) => (
                        <TableHead key={i} className={`text-sm font-semibold ${i > 0 ? "text-right" : ""}`}>{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <GenericReportSection rows={reportResult.rows} columns={reportResult.columns} />
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !reportResult && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <p className="text-lg">Click "Run Report" to fetch live data from QuickBooks.</p>
        </CardContent></Card>
      )}
    </div>
  );
}
