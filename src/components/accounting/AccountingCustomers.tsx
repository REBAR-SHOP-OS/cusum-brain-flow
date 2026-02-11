import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search } from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingCustomers({ data }: Props) {
  const { customers, invoices } = data;
  const [search, setSearch] = useState("");

  const filtered = customers.filter(
    (c) =>
      c.DisplayName.toLowerCase().includes(search.toLowerCase()) ||
      (c.CompanyName || "").toLowerCase().includes(search.toLowerCase())
  );

  // Enrich with invoice stats
  const enriched = filtered.map((c) => {
    const custInvoices = invoices.filter(i => i.CustomerRef?.value === c.Id);
    const openBalance = custInvoices.reduce((sum, i) => sum + (i.Balance || 0), 0);
    const overdue = custInvoices.filter(i => i.Balance > 0 && new Date(i.DueDate) < new Date()).length;
    return { ...c, openBalance, overdue, invoiceCount: custInvoices.length };
  });

  enriched.sort((a, b) => a.DisplayName.localeCompare(b.DisplayName, undefined, { sensitivity: 'base' }));

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 text-base"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Customers ({enriched.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {enriched.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-lg">
              No customers found — sync from QuickBooks first
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Name</TableHead>
                  <TableHead className="text-base">Company</TableHead>
                  <TableHead className="text-base text-center">Invoices</TableHead>
                  <TableHead className="text-base text-right">Open Balance</TableHead>
                  <TableHead className="text-base text-center">Overdue</TableHead>
                  <TableHead className="text-base">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map((c) => (
                  <TableRow key={c.Id} className="text-base">
                    <TableCell className="font-semibold">{c.DisplayName}</TableCell>
                    <TableCell>{c.CompanyName || "—"}</TableCell>
                    <TableCell className="text-center">{c.invoiceCount}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {c.openBalance > 0 ? fmt(c.openBalance) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.overdue > 0 ? (
                        <Badge variant="destructive" className="text-sm">{c.overdue}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border-0 text-sm ${c.Active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                        {c.Active ? "Active" : "Inactive"}
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
