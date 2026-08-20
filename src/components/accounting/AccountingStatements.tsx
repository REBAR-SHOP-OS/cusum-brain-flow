import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, Download, Search, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

interface StatementLine {
  date: string;
  type: string;
  docNumber: string;
  amount: number;
  balance: number;
}

export function AccountingStatements({ data }: Props) {
  const { toast } = useToast();
  const [customerId, setCustomerId] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [generated, setGenerated] = useState(false);

  const customers = data.customers || [];
  const filteredCustomers = customers.filter(c =>
    (c as any).DisplayName?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c as any).CompanyName?.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const generate = async () => {
    if (!customerId) return;
    setLoading(true);
    setGenerated(false);
    try {
      const { data: res, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "customer-statement", customerId, startDate, endDate },
      });
      if (error) throw error;
      setLines(res?.lines || []);
      setGenerated(true);
      toast({ title: "Statement generated" });
    } catch (e: any) {
      // Fallback: build statement from local invoice/payment data
      const custInvoices = data.invoices.filter(i => (i as any).CustomerRef?.value === customerId);
      const fallbackLines: StatementLine[] = custInvoices.map(inv => ({
        date: (inv as any).TxnDate || "",
        type: "Invoice",
        docNumber: (inv as any).DocNumber || "",
        amount: (inv as any).TotalAmt || 0,
        balance: (inv as any).Balance || 0,
      })).sort((a, b) => a.date.localeCompare(b.date));
      setLines(fallbackLines);
      setGenerated(true);
      toast({ title: "Statement generated (local data)", description: "Using cached invoice data." });
    } finally {
      setLoading(false);
    }
  };

  const runningBalance = () => {
    let bal = 0;
    return lines.map(l => { bal += l.amount; return { ...l, runningBal: bal }; });
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="w-5 h-5" /> Customer Statements</h2>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label>Customer</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="Search customers..." className="pl-9 mb-2" />
            </div>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select customer...</option>
              {filteredCustomers.slice(0, 50).map((c: any) => (
                <option key={c.Id} value={c.Id}>{c.DisplayName || c.CompanyName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div><Label>End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          </div>
          <Button onClick={generate} disabled={loading || !customerId} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generate Statement
          </Button>
        </CardContent>
      </Card>

      {generated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Statement ({lines.length} transactions)</span>
              <Button variant="outline" size="sm" className="gap-1 h-8" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No transactions found for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Doc #</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                      <th className="py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runningBalance().map((l, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-4">{l.date}</td>
                        <td className="py-2 pr-4">{l.type}</td>
                        <td className="py-2 pr-4">{l.docNumber}</td>
                        <td className="py-2 pr-4 text-right">{fmt(l.amount)}</td>
                        <td className="py-2 text-right font-medium">{fmt(l.runningBal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
