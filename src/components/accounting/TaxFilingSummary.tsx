import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TaxRow {
  label: string;
  amount: number;
}

export function TaxFilingSummary() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<{ title: string; rows: TaxRow[]; total: number }[]>([]);
  const [period, setPeriod] = useState<"this_quarter" | "last_quarter" | "ytd">("this_quarter");

  const getDateRange = (p: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const qStart = Math.floor(month / 3) * 3;
    switch (p) {
      case "last_quarter": {
        const s = new Date(year, qStart - 3, 1);
        const e = new Date(year, qStart, 0);
        return { startDate: s.toISOString().split("T")[0], endDate: e.toISOString().split("T")[0] };
      }
      case "ytd":
        return { startDate: `${year}-01-01`, endDate: now.toISOString().split("T")[0] };
      default: {
        const s = new Date(year, qStart, 1);
        return { startDate: s.toISOString().split("T")[0], endDate: now.toISOString().split("T")[0] };
      }
    }
  };

  const parseReport = (data: any) => {
    const parsed: { title: string; rows: TaxRow[]; total: number }[] = [];
    const rows = data?.Rows?.Row || [];
    for (const section of rows) {
      if (section.type === "Section" && section.Header) {
        const title = section.Header?.ColData?.[0]?.value || "Unknown";
        const sectionRows: TaxRow[] = [];
        let total = 0;
        for (const row of section.Rows?.Row || []) {
          if (row.ColData) {
            sectionRows.push({
              label: row.ColData[0]?.value || "",
              amount: parseFloat(row.ColData[1]?.value || "0"),
            });
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
        body: { action: "get-tax-summary", startDate, endDate },
      });
      if (error) throw error;
      parseReport(res?.report);
    } catch (e: any) {
      toast({ title: "Failed to load tax summary", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const taxCollected = sections.find(s => s.title.toLowerCase().includes("collected") || s.title.toLowerCase().includes("sales"))?.total || 0;
  const taxPaid = sections.find(s => s.title.toLowerCase().includes("paid") || s.title.toLowerCase().includes("purchase"))?.total || 0;
  const netOwing = taxCollected - Math.abs(taxPaid);

  const periods = [
    { key: "this_quarter", label: "This Quarter" },
    { key: "last_quarter", label: "Last Quarter" },
    { key: "ytd", label: "Year to Date" },
  ] as const;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> HST/GST Filing Summary
          </CardTitle>
          <div className="flex items-center gap-2">
            {periods.map(p => (
              <Button key={p.key} variant={period === p.key ? "default" : "outline"} size="sm" onClick={() => setPeriod(p.key)}>
                {p.label}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              {sections.length === 0 ? "Load" : "Refresh"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && sections.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : sections.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">Click "Load" to fetch your QuickBooks Tax Summary.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                <p className="text-xs text-muted-foreground uppercase">HST Collected</p>
                <p className="text-xl font-bold text-emerald-600">{fmt(taxCollected)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-500/10">
                <p className="text-xs text-muted-foreground uppercase">ITC Claimed</p>
                <p className="text-xl font-bold text-blue-600">{fmt(Math.abs(taxPaid))}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-primary/10">
                <p className="text-xs text-muted-foreground uppercase">Net Owing</p>
                <p className={`text-xl font-bold ${netOwing >= 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {fmt(netOwing)}
                </p>
                <Badge variant={netOwing >= 0 ? "destructive" : "default"} className="text-xs mt-1">
                  {netOwing >= 0 ? "You owe CRA" : "CRA owes you"}
                </Badge>
              </div>
            </div>

            {sections.map((sec, i) => (
              <div key={i}>
                <h4 className="font-semibold text-sm mb-2">{sec.title}</h4>
                <table className="w-full text-sm">
                  <tbody>
                    {sec.rows.map((row, j) => (
                      <tr key={j} className="border-b border-border/30">
                        <td className="py-1.5">{row.label}</td>
                        <td className="py-1.5 text-right font-medium">{fmt(row.amount)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-muted/30">
                      <td className="py-1.5 px-1">Total</td>
                      <td className="py-1.5 px-1 text-right">{fmt(sec.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
