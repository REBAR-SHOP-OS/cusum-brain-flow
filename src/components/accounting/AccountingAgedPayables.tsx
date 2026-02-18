import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Clock, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

interface AgingRow {
  label: string;
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90plus: number;
  total: number;
  children: AgingRow[];
}

function parseAgingReport(report: Record<string, unknown>): AgingRow[] {
  const rows: AgingRow[] = [];
  const reportRows = (report?.Rows as any)?.Row || [];

  function extractRow(r: any): AgingRow | null {
    const colData = r.ColData || r.Summary?.ColData;
    if (!colData) return null;
    const vals = colData.map((c: any) => c.value || "");
    return {
      label: vals[0] || "",
      current: parseFloat(vals[1] || "0") || 0,
      days1_30: parseFloat(vals[2] || "0") || 0,
      days31_60: parseFloat(vals[3] || "0") || 0,
      days61_90: parseFloat(vals[4] || "0") || 0,
      days90plus: parseFloat(vals[5] || "0") || 0,
      total: parseFloat(vals[6] || vals[vals.length - 1] || "0") || 0,
      children: [],
    };
  }

  for (const row of reportRows) {
    if (row.Header) {
      const headerCols = row.Header.ColData;
      const label = headerCols?.[0]?.value || "";
      const children: AgingRow[] = [];
      const innerRows = row.Rows?.Row || [];
      for (const ir of innerRows) {
        const child = extractRow(ir);
        if (child) children.push(child);
      }
      const summary = extractRow({ ColData: row.Summary?.ColData });
      rows.push({
        label,
        current: summary?.current || 0,
        days1_30: summary?.days1_30 || 0,
        days31_60: summary?.days31_60 || 0,
        days61_90: summary?.days61_90 || 0,
        days90plus: summary?.days90plus || 0,
        total: summary?.total || 0,
        children,
      });
    } else {
      const item = extractRow(row);
      if (item) rows.push(item);
    }
  }
  return rows;
}

function AgingSection({ rows, depth = 0 }: { rows: AgingRow[]; depth?: number }) {
  return (
    <>
      {rows.map((row, i) => {
        if (row.children.length > 0) {
          return <CollapsibleAgingRow key={`${row.label}-${i}`} row={row} depth={depth} />;
        }
        const isTotal = row.label.toLowerCase().startsWith("total");
        return (
          <TableRow key={`${row.label}-${i}`} className={isTotal ? "bg-muted/30 font-bold" : ""}>
            <TableCell style={{ paddingLeft: `${16 + depth * 20}px` }} className="text-sm">{row.label}</TableCell>
            <TableCell className="text-right text-sm">{fmt(row.current)}</TableCell>
            <TableCell className="text-right text-sm">{fmt(row.days1_30)}</TableCell>
            <TableCell className="text-right text-sm">{fmt(row.days31_60)}</TableCell>
            <TableCell className="text-right text-sm">{fmt(row.days61_90)}</TableCell>
            <TableCell className="text-right text-sm">{fmt(row.days90plus)}</TableCell>
            <TableCell className="text-right text-sm font-semibold">{fmt(row.total)}</TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

function CollapsibleAgingRow({ row, depth }: { row: AgingRow; depth: number }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <TableRow className="bg-muted/20">
        <TableCell style={{ paddingLeft: `${16 + depth * 20}px` }} className="text-sm font-semibold">
          <CollapsibleTrigger className="flex items-center gap-1 hover:text-primary cursor-pointer">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {row.label}
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="text-right text-sm font-semibold">{!open ? fmt(row.current) : ""}</TableCell>
        <TableCell className="text-right text-sm font-semibold">{!open ? fmt(row.days1_30) : ""}</TableCell>
        <TableCell className="text-right text-sm font-semibold">{!open ? fmt(row.days31_60) : ""}</TableCell>
        <TableCell className="text-right text-sm font-semibold">{!open ? fmt(row.days61_90) : ""}</TableCell>
        <TableCell className="text-right text-sm font-semibold">{!open ? fmt(row.days90plus) : ""}</TableCell>
        <TableCell className="text-right text-sm font-semibold">{!open ? fmt(row.total) : ""}</TableCell>
      </TableRow>
      <CollapsibleContent>
        <AgingSection rows={row.children} depth={depth + 1} />
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AccountingAgedPayables({ data }: Props) {
  const { qbAction } = data;
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<AgingRow[] | null>(null);
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const runReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await qbAction("get-aged-payables", { asOfDate });
      const report = result?.report || result;
      setReportData(parseAgingReport(report));
    } catch (err) {
      console.error("Aged Payables fetch failed:", err);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [qbAction, asOfDate]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" />
          Aged Payables
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Aging buckets for outstanding vendor balances</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">As of Date</Label>
              <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="h-9 w-[180px]" />
            </div>
            <Button onClick={runReport} disabled={loading} className="h-9 gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Run Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card><CardContent className="p-6 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </CardContent></Card>
      )}

      {!loading && reportData && (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 pb-2 border-b">
              <h3 className="font-bold text-lg">A/P Aging Detail</h3>
              <p className="text-xs text-muted-foreground">As of {asOfDate}</p>
            </div>
            {reportData.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No data returned.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm font-semibold">Vendor / Transaction</TableHead>
                    <TableHead className="text-sm font-semibold text-right">Current</TableHead>
                    <TableHead className="text-sm font-semibold text-right">1-30</TableHead>
                    <TableHead className="text-sm font-semibold text-right">31-60</TableHead>
                    <TableHead className="text-sm font-semibold text-right">61-90</TableHead>
                    <TableHead className="text-sm font-semibold text-right">90+</TableHead>
                    <TableHead className="text-sm font-semibold text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AgingSection rows={reportData} />
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && !reportData && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <p className="text-lg">Click "Run Report" to fetch aging data from QuickBooks.</p>
        </CardContent></Card>
      )}
    </div>
  );
}
