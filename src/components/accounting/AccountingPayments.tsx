import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Search } from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingPayments({ data }: Props) {
  const { payments } = data;
  const [search, setSearch] = useState("");

  const sorted = [...payments]
    .sort((a, b) => new Date(b.TxnDate).getTime() - new Date(a.TxnDate).getTime());

  const filtered = sorted.filter(
    (p) => (p.CustomerRef?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalCollected = payments.reduce((sum, p) => sum + p.TotalAmt, 0);

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
