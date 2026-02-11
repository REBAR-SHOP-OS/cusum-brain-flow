import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Store, Search } from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingVendors({ data }: Props) {
  const { vendors, bills } = data;
  const [search, setSearch] = useState("");

  const filtered = vendors.filter(
    (v: any) =>
      (v.DisplayName || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.CompanyName || "").toLowerCase().includes(search.toLowerCase())
  );

  const enriched = filtered.map((v: any) => {
    const vendorBills = bills.filter((b: any) => b.VendorRef?.value === v.Id);
    const openBalance = vendorBills.reduce((sum: number, b: any) => sum + (b.Balance || 0), 0);
    const overdue = vendorBills.filter((b: any) => b.Balance > 0 && new Date(b.DueDate) < new Date()).length;
    return { ...v, openBalance, overdue, billCount: vendorBills.length };
  });

  enriched.sort((a: any, b: any) => (a.DisplayName || "").localeCompare(b.DisplayName || "", undefined, { sensitivity: 'base' }));

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search vendors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 text-base"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            Vendors ({enriched.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {enriched.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-lg">
              No vendors found — sync from QuickBooks first
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Name</TableHead>
                  <TableHead className="text-base">Company</TableHead>
                  <TableHead className="text-base text-center">Bills</TableHead>
                  <TableHead className="text-base text-right">Open Balance</TableHead>
                  <TableHead className="text-base text-center">Overdue</TableHead>
                  <TableHead className="text-base">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map((v: any) => (
                  <TableRow key={v.Id} className="text-base">
                    <TableCell className="font-semibold">{v.DisplayName}</TableCell>
                    <TableCell>{v.CompanyName || "—"}</TableCell>
                    <TableCell className="text-center">{v.billCount}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {v.openBalance > 0 ? fmt(v.openBalance) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {v.overdue > 0 ? (
                        <Badge variant="destructive" className="text-sm">{v.overdue}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border-0 text-sm ${v.Active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                        {v.Active ? "Active" : "Inactive"}
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
