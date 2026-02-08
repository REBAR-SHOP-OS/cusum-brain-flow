import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, Search, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search bills or vendors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 text-base"
        />
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
                              isPaid ? "bg-emerald-500/10 text-emerald-500" :
                              isOverdue ? "bg-destructive/10 text-destructive" :
                              "bg-blue-500/10 text-blue-500"
                            }`}>
                              {isPaid ? "Paid" : isOverdue ? "Overdue" : "Open"}
                            </Badge>
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
                      <TableRow key={v.Id} className="text-base">
                        <TableCell className="font-semibold">{v.DisplayName}</TableCell>
                        <TableCell>{v.CompanyName || "—"}</TableCell>
                        <TableCell>{v.PrimaryPhone?.FreeFormNumber || "—"}</TableCell>
                        <TableCell>{v.PrimaryEmailAddr?.Address || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(v.Balance || 0)}</TableCell>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
