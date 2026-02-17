import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Store, Search, AlertTriangle, FileText, DollarSign, ChevronDown } from "lucide-react";
import type { useQuickBooksData, QBVendor, QBBill } from "@/hooks/useQuickBooksData";
import { VendorDetail } from "./VendorDetail";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

interface EnrichedVendor extends QBVendor {
  openBalance: number;
  overdue: number;
  billCount: number;
  paidLast30: number;
  paidLast30Count: number;
}

export function AccountingVendors({ data }: Props) {
  const { vendors, bills } = data;
  const [search, setSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<QBVendor | null>(null);

  const filtered = vendors.filter(
    (v) =>
      (v.DisplayName || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.CompanyName || "").toLowerCase().includes(search.toLowerCase())
  );

  const enriched: EnrichedVendor[] = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return filtered.map((v) => {
      const vendorBills = bills.filter((b) => b.VendorRef?.value === v.Id);
      const openBalance = vendorBills.reduce((sum, b) => sum + (b.Balance || 0), 0);
      const overdue = vendorBills.filter((b) => b.Balance > 0 && new Date(b.DueDate) < now).length;
      const paidBills = vendorBills.filter((b) => b.Balance <= 0 && new Date(b.TxnDate) >= thirtyDaysAgo);
      const paidLast30 = paidBills.reduce((sum, b) => sum + (b.TotalAmt || 0), 0);
      return { ...v, openBalance, overdue, billCount: vendorBills.length, paidLast30, paidLast30Count: paidBills.length };
    }).sort((a, b) => (a.DisplayName || "").localeCompare(b.DisplayName || "", undefined, { sensitivity: 'base' }));
  }, [filtered, bills]);

  // Summary stats
  const stats = useMemo(() => {
    const now = new Date();
    let overdueCount = 0;
    let totalOverdue = 0;
    let openBillCount = 0;
    let totalOpen = 0;
    let paidCount = 0;
    let totalPaid30 = 0;

    enriched.forEach((v) => {
      const overdueBills = bills.filter((b) => b.VendorRef?.value === v.Id && b.Balance > 0 && new Date(b.DueDate) < now);
      overdueCount += overdueBills.length;
      totalOverdue += overdueBills.reduce((a, b) => a + b.Balance, 0);

      const openBills = bills.filter((b) => b.VendorRef?.value === v.Id && b.Balance > 0);
      openBillCount += openBills.length;
      totalOpen += v.openBalance;

      paidCount += v.paidLast30Count;
      totalPaid30 += v.paidLast30;
    });

    return { overdueCount, totalOverdue, openBillCount, totalOpen, paidCount, totalPaid30 };
  }, [enriched, bills]);

  return (
    <div className="space-y-4">
      {/* Summary bar with counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{stats.overdueCount} Overdue</p>
              <p className="text-xl font-bold text-destructive">{fmt(stats.totalOverdue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{stats.openBillCount} Open Bills</p>
              <p className="text-xl font-bold">{fmt(stats.totalOpen)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <DollarSign className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{stats.paidCount} Paid Last 30 Days</p>
              <p className="text-xl font-bold text-success">{fmt(stats.totalPaid30)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <TableHead className="text-base">Phone</TableHead>
                  <TableHead className="text-base">Email</TableHead>
                  <TableHead className="text-base text-center">Bills</TableHead>
                  <TableHead className="text-base text-right">Open Balance</TableHead>
                  <TableHead className="text-base text-center">Overdue</TableHead>
                  <TableHead className="text-base">Status</TableHead>
                  <TableHead className="text-base">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map((v) => (
                  <TableRow
                    key={v.Id}
                    className="text-base cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedVendor(v)}
                  >
                    <TableCell className="font-semibold">{v.DisplayName}</TableCell>
                    <TableCell>{v.CompanyName || "—"}</TableCell>
                    <TableCell className="text-sm">{v.PrimaryPhone?.FreeFormNumber || "—"}</TableCell>
                    <TableCell className="text-sm">{v.PrimaryEmailAddr?.Address || "—"}</TableCell>
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
                      <Badge className={`border-0 text-sm ${v.Active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {v.Active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                            {v.openBalance > 0 ? "Make payment" : "Create bill"}
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Create bill</DropdownMenuItem>
                          <DropdownMenuItem>Make payment</DropdownMenuItem>
                          <DropdownMenuItem>Create expense</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Vendor Detail Sheet */}
      <Sheet open={!!selectedVendor} onOpenChange={(open) => !open && setSelectedVendor(null)}>
        <SheetContent className="w-full sm:max-w-xl p-0 overflow-hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>{selectedVendor?.DisplayName}</SheetTitle>
          </SheetHeader>
          {selectedVendor && <VendorDetail vendor={selectedVendor} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

AccountingVendors.displayName = "AccountingVendors";
