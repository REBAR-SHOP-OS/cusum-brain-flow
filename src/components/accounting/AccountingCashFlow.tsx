import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CashFlowSection {
  title: string;
  rows: { label: string; amount: number }[];
  total: number;
}

export function AccountingCashFlow() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [sections, setSections] = useState<CashFlowSection[]>([]);
  const [period, setPeriod] = useState<"this_month" | "last_month" | "this_quarter" | "ytd">("this_month");

  const getDateRange = (p: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    switch (p) {
      case "last_month": {
        const d = new Date(year, month - 1, 1);
        return { startDate: d.toISOString().split("T")[0], endDate: new Date(year, month, 0).toISOString().split("T")[0] };
      }
      case "this_quarter": {
        const qStart = new Date(year, Math.floor(month / 3) * 3, 1);
        return { startDate: qStart.toISOString().split("T")[0], endDate: now.toISOString().split("T")[0] };
      }
      case "ytd":
        return { startDate: `${year}-01-01`, endDate: now.toISOString().split("T")[0] };
      default: {
        const start = new Date(year, month, 1);
        return { startDate: start.toISOString().split("T")[0], endDate: now.toISOString().split("T")[0] };
      }
    }
  };

  const parseReport = (data: any) => {
    const parsed: CashFlowSection[] = [];
    const rows = data?.Rows?.Row || [];
    for (const section of rows) {
      if (section.type === "Section" && section.Header) {
        const title = section.Header?.ColData?.[0]?.value || "Unknown";
        const sectionRows: { label: string; amount: number }[] = [];
        let total = 0;
        for (const row of section.Rows?.Row || []) {
          if (row.ColData) {
            const label = row.ColData[0]?.value || "";
            const amount = parseFloat(row.ColData[1]?.value || "0");
            sectionRows.push({ label, amount });
          }
          if (row.Summary?.ColData) {
            total = parseFloat(row.Summary.ColData[1]?.value || "0");
          }
        }
        if (section.Summary?.ColData) {
          total = parseFloat(section.Summary.ColData[1]?.value || "0");
        }
        parsed.push({ title, rows: sectionRows, total });
      }
    }
    setSections(parsed);
  };

  const load = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(period);
      const { data: res, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "get-cash-flow", startDate, endDate },
      });
      if (error) throw error;
      setReport(res?.report);
      parseReport(res?.report);
    } catch (e: any) {
      toast({ title: "Failed to load cash flow", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const netCash = sections.reduce((s, sec) => s + sec.total, 0);

  const periods = [
    { key: "this_month", label: "This Month" },
    { key: "last_month", label: "Last Month" },
    { key: "this_quarter", label: "This Quarter" },
    { key: "ytd", label: "Year to Date" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <DollarSign className="w-5 h-5" /> Cash Flow Statement
        </h2>
        <div className="flex items-center gap-2">
          {periods.map(p => (
            <Button
              key={p.key}
              variant={period === p.key ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {sections.length === 0 ? "Load Report" : "Refresh"}
          </Button>
        </div>
      </div>

      {loading && sections.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Click "Load Report" to fetch your QuickBooks Cash Flow Statement.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {sections.map((sec, i) => (
              <Card key={i}>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{sec.title}</p>
                  <p className={`text-2xl font-bold ${sec.total >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {fmt(sec.total)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Net Cash */}
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {netCash >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
                <span className="font-semibold text-lg">Net Change in Cash</span>
              </div>
              <Badge variant={netCash >= 0 ? "default" : "destructive"} className="text-lg px-4 py-1">
                {fmt(netCash)}
              </Badge>
            </CardContent>
          </Card>

          {/* Detail sections */}
          {sections.map((sec, i) => (
            <Card key={i}>
              <CardHeader className="py-3">
                <CardTitle className="text-base">{sec.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {sec.rows.map((row, j) => (
                      <tr key={j} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-4">{row.label}</td>
                        <td className={`py-2 px-4 text-right font-medium ${row.amount < 0 ? "text-destructive" : ""}`}>
                          {fmt(row.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 font-bold">
                      <td className="py-2 px-4">Total</td>
                      <td className={`py-2 px-4 text-right ${sec.total < 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {fmt(sec.total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
