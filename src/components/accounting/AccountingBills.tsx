import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Receipt, Search, Building2, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorDetail } from "@/components/accounting/VendorDetail";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingBills({ data }: Props) {
  const { bills, vendors } = data;
  const [search, setSearch] = useState("");
  const [subTab, setSubTab] = useState("bills");
  const [selectedVendor, setSelectedVendor] = useState<any | null>(null);
  const [selectedBill, setSelectedBill] = useState<any | null>(null);

  const filteredBills = bills.filter(
    (b) =>
      (b.DocNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (b.VendorRef?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredVendors = vendors.filter(
    (v) =>
      (v.DisplayName || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.CompanyName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search bills or vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
        <Button
          size="sm"
          className="h-12 gap-2"
          onClick={() => toast({ title: "Coming soon", description: "Bill creation will be available in a future update." })}
        >
          <Plus className="w-4 h-4" /> Add Bill
        </Button>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="h-12">
          <TabsTrigger value="bills" className="text-base h-10 gap-2">
            <Receipt className="w-4 h-4" /> Bills ({bills.length})
          </TabsTrigger>
          <TabsTrigger value="vendors" className="text-base h-10 gap-2">
            <Building2 className="w-4 h-4" /> Vendors ({vendors.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bills" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {filteredBills.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-lg">No bills found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base">Bill #</TableHead>
                      <TableHead className="text-base">Vendor</TableHead>
                      <TableHead className="text-base">Date</TableHead>
                      <TableHead className="text-base">Due</TableHead>
                      <TableHead className="text-base text-right">Total</TableHead>
                      <TableHead className="text-base text-right">Balance</TableHead>
                      <TableHead className="text-base">Status</TableHead>
                      <TableHead className="text-base">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBills.map((b) => {
                      const isPaid = b.Balance === 0;
                      const isOverdue = !isPaid && new Date(b.DueDate) < new Date();
                      return (
                        <TableRow key={b.Id} className="text-base">
                          <TableCell className="font-mono font-semibold">#{b.DocNumber}</TableCell>
                          <TableCell className="font-medium">{b.VendorRef?.name || "—"}</TableCell>
                          <TableCell>{b.TxnDate ? new Date(b.TxnDate).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>{b.DueDate ? new Date(b.DueDate).toLocaleDateString() : "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(b.TotalAmt)}</TableCell>
                          <TableCell className="text-right font-semibold">{fmt(b.Balance)}</TableCell>
                          <TableCell>
                          <Badge className={`border-0 text-sm ${
                              isPaid ? "bg-success/10 text-success" :
                              isOverdue ? "bg-destructive/10 text-destructive" :
                              "bg-primary/10 text-primary"
                            }`}>
                              {isPaid ? "Paid" : isOverdue ? "Overdue" : "Open"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="gap-1" onClick={() => setSelectedBill(b)}>
                              <Eye className="w-4 h-4" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendors" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {filteredVendors.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-lg">No vendors found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base">Name</TableHead>
                      <TableHead className="text-base">Company</TableHead>
                      <TableHead className="text-base">Phone</TableHead>
                      <TableHead className="text-base">Email</TableHead>
                      <TableHead className="text-base text-right">Balance</TableHead>
                      <TableHead className="text-base">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendors.map((v) => (
                      <TableRow
                        key={v.Id}
                        className="text-base cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedVendor(v)}
                      >
                        <TableCell className="font-semibold">{v.DisplayName}</TableCell>
                        <TableCell>{v.CompanyName || "—"}</TableCell>
                        <TableCell>{v.PrimaryPhone?.FreeFormNumber || "—"}</TableCell>
                        <TableCell>{v.PrimaryEmailAddr?.Address || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(v.Balance || 0)}</TableCell>
                        <TableCell>
                          <Badge className={`border-0 text-sm ${v.Active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
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
        </TabsContent>
      </Tabs>

      {/* Vendor Detail Sheet */}
      <Sheet open={!!selectedVendor} onOpenChange={(open) => { if (!open) setSelectedVendor(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 overflow-hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Vendor Details</SheetTitle>
            <SheetDescription>View vendor details and transactions</SheetDescription>
          </SheetHeader>
          {selectedVendor && <VendorDetail vendor={selectedVendor} />}
        </SheetContent>
      </Sheet>

      {/* Bill Detail Sheet */}
      <Sheet open={!!selectedBill} onOpenChange={(o) => { if (!o) setSelectedBill(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Bill #{selectedBill?.DocNumber}</SheetTitle>
            <SheetDescription>Full bill details</SheetDescription>
          </SheetHeader>
          {selectedBill && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Vendor</p><p className="font-medium">{selectedBill.VendorRef?.name || "—"}</p></div>
                <div><p className="text-sm text-muted-foreground">Date</p><p className="font-medium">{selectedBill.TxnDate ? new Date(selectedBill.TxnDate).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-sm text-muted-foreground">Due Date</p><p className="font-medium">{selectedBill.DueDate ? new Date(selectedBill.DueDate).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-sm text-muted-foreground">Total</p><p className="font-semibold text-lg">{fmt(selectedBill.TotalAmt)}</p></div>
                <div><p className="text-sm text-muted-foreground">Balance</p><p className="font-semibold text-lg">{fmt(selectedBill.Balance)}</p></div>
                <div><p className="text-sm text-muted-foreground">Status</p><Badge className={`border-0 ${selectedBill.Balance === 0 ? "bg-success/10 text-success" : new Date(selectedBill.DueDate) < new Date() ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{selectedBill.Balance === 0 ? "Paid" : new Date(selectedBill.DueDate) < new Date() ? "Overdue" : "Open"}</Badge></div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

AccountingBills.displayName = "AccountingBills";
