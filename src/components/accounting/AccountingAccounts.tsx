import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark, Search, FileBarChart } from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingAccounts({ data }: Props) {
  const { accounts, estimates } = data;
  const [search, setSearch] = useState("");
  const [subTab, setSubTab] = useState("accounts");

  const filteredAccounts = accounts.filter(
    (a) =>
      a.Name.toLowerCase().includes(search.toLowerCase()) ||
      a.AccountType.toLowerCase().includes(search.toLowerCase())
  );

  const filteredEstimates = estimates.filter(
    (e) =>
      (e.DocNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.CustomerRef?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  // Group accounts by type
  const grouped = filteredAccounts.reduce((acc, a) => {
    const type = a.AccountType || "Other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(a);
    return acc;
  }, {} as Record<string, typeof accounts>);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search accounts or estimates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-12 text-base"
        />
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="h-12">
          <TabsTrigger value="accounts" className="text-base h-10 gap-2">
            <Landmark className="w-4 h-4" /> Chart of Accounts ({accounts.length})
          </TabsTrigger>
          <TabsTrigger value="estimates" className="text-base h-10 gap-2">
            <FileBarChart className="w-4 h-4" /> Estimates ({estimates.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4 space-y-4">
          {Object.entries(grouped).map(([type, accts]) => (
            <Card key={type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Landmark className="w-4 h-4" />
                  {type} ({accts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base">Account Name</TableHead>
                      <TableHead className="text-base text-right">Balance</TableHead>
                      <TableHead className="text-base">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accts.map((a) => (
                      <TableRow key={a.Id} className="text-base">
                        <TableCell className="font-medium">{a.Name}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(a.CurrentBalance || 0)}</TableCell>
                        <TableCell>
                          <Badge className={`border-0 text-sm ${a.Active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                            {a.Active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-lg">No accounts found</div>
          )}
        </TabsContent>

        <TabsContent value="estimates" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {filteredEstimates.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-lg">No estimates found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base">Estimate #</TableHead>
                      <TableHead className="text-base">Customer</TableHead>
                      <TableHead className="text-base">Date</TableHead>
                      <TableHead className="text-base">Expires</TableHead>
                      <TableHead className="text-base text-right">Total</TableHead>
                      <TableHead className="text-base">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEstimates.map((e) => (
                      <TableRow key={e.Id} className="text-base">
                        <TableCell className="font-mono font-semibold">#{e.DocNumber}</TableCell>
                        <TableCell className="font-medium">{e.CustomerRef?.name || "—"}</TableCell>
                        <TableCell>{e.TxnDate ? new Date(e.TxnDate).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>{e.ExpirationDate ? new Date(e.ExpirationDate).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(e.TotalAmt)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-sm">{e.TxnStatus || "Pending"}</Badge>
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
