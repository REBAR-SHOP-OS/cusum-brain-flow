import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Search, FileText, AlertCircle } from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingPayments({ data }: Props) {
  const { payments, invoices, customers } = data;
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");

  // Build unique customer list from payments + invoices
  const customerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of customers) {
      map.set(c.Id, c.DisplayName);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [customers]);

  // Outstanding invoices for selected customer (Balance > 0)
  const outstandingInvoices = useMemo(() => {
    if (selectedCustomerId === "all") return [];
    return invoices.filter(
      (inv) =>
        inv.Balance > 0 &&
        inv.CustomerRef?.value === selectedCustomerId
    );
  }, [invoices, selectedCustomerId]);

  const totalOutstanding = useMemo(
    () => outstandingInvoices.reduce((sum, inv) => sum + inv.Balance, 0),
    [outstandingInvoices]
  );

  const sorted = [...payments]
    .sort((a, b) => new Date(b.TxnDate).getTime() - new Date(a.TxnDate).getTime());

  const filtered = sorted.filter((p) => {
    const matchesSearch = (p.CustomerRef?.name || "").toLowerCase().includes(search.toLowerCase());
    const matchesCustomer = selectedCustomerId === "all" || p.CustomerRef?.value === selectedCustomerId;
    return matchesSearch && matchesCustomer;
  });

  const totalCollected = (selectedCustomerId === "all" ? payments : filtered)
    .reduce((sum, p) => sum + p.TotalAmt, 0);

  return (
    <div className="space-y-4">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.Id} className="text-base">
                    <TableCell>{new Date(p.TxnDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{p.CustomerRef?.name || "Unknown"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="text-base px-3 py-1 text-success border-success/30">
                        +{fmt(p.TotalAmt)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

AccountingPayments.displayName = "AccountingPayments";
