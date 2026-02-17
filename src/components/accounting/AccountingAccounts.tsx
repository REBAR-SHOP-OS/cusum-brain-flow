import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Landmark, Search, FileBarChart, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AccountQuickReportDrawer } from "./AccountQuickReportDrawer";
import { NewAccountDrawer } from "./NewAccountDrawer";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

interface AccountNode {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType: string;
  CurrentBalance: number;
  Active: boolean;
  AcctNum?: string;
  SubAccount?: boolean;
  ParentRef?: { value: string };
  BankBalance?: number;
  TaxCodeRef?: string;
  depth: number;
}

function buildAccountTree(accounts: ReturnType<typeof useQuickBooksData>["accounts"]): AccountNode[] {
  // Extract raw_json fields if available
  const rawAccounts = accounts.map((a) => {
    const raw = a as unknown as Record<string, unknown>;
    return {
      Id: a.Id,
      Name: a.Name,
      AccountType: a.AccountType,
      AccountSubType: a.AccountSubType,
      CurrentBalance: a.CurrentBalance,
      Active: a.Active,
      AcctNum: (raw.AcctNum as string) || "",
      SubAccount: (raw.SubAccount as boolean) || false,
      ParentRef: raw.ParentRef as { value: string } | undefined,
      BankBalance: raw.BankBalance as number | undefined,
      TaxCodeRef: (raw.TaxCodeRef as any)?.name || (raw.TaxCodeRef as any)?.value || undefined,
      depth: 0,
    };
  });

  // Build depth map
  const idMap = new Map(rawAccounts.map((a) => [a.Id, a]));

  function getDepth(a: AccountNode): number {
    if (!a.SubAccount || !a.ParentRef) return 0;
    const parent = idMap.get(a.ParentRef.value);
    if (!parent) return 0;
    return 1 + getDepth(parent);
  }

  rawAccounts.forEach((a) => {
    a.depth = getDepth(a);
  });

  // Sort: parents first, then children alphabetically under parent
  const sorted: AccountNode[] = [];
  const topLevel = rawAccounts.filter((a) => !a.SubAccount).sort((a, b) => a.Name.localeCompare(b.Name, undefined, { sensitivity: "base" }));

  function addWithChildren(parent: AccountNode) {
    sorted.push(parent);
    const children = rawAccounts
      .filter((a) => a.SubAccount && a.ParentRef?.value === parent.Id)
      .sort((a, b) => a.Name.localeCompare(b.Name, undefined, { sensitivity: "base" }));
    children.forEach(addWithChildren);
  }

  topLevel.forEach(addWithChildren);

  // Add any orphans
  const inSorted = new Set(sorted.map((a) => a.Id));
  rawAccounts.filter((a) => !inSorted.has(a.Id)).forEach((a) => sorted.push(a));

  return sorted;
}

export function AccountingAccounts({ data }: Props) {
  const { accounts, estimates } = data;
  const [search, setSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<{ Id: string; Name: string; CurrentBalance: number } | null>(null);
  const [subTab, setSubTab] = useState("accounts");
  const [typeFilter, setTypeFilter] = useState("all");
  const [newAccountOpen, setNewAccountOpen] = useState(false);

  const accountTree = useMemo(() => buildAccountTree(accounts), [accounts]);

  const accountTypes = useMemo(() => {
    const types = new Set(accounts.map((a) => a.AccountType));
    return Array.from(types).sort();
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    return accountTree.filter((a) => {
      const matchesSearch =
        a.Name.toLowerCase().includes(search.toLowerCase()) ||
        a.AccountType.toLowerCase().includes(search.toLowerCase()) ||
        (a.AcctNum || "").toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || a.AccountType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [accountTree, search, typeFilter]);

  const filteredEstimates = estimates.filter(
    (e) =>
      (e.DocNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.CustomerRef?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search accounts or estimates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
        {subTab === "accounts" && (
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-12 w-[200px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {accountTypes.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {subTab === "accounts" && (
          <Button onClick={() => setNewAccountOpen(true)} className="h-12 gap-2">
            <Plus className="w-4 h-4" /> New
          </Button>
        )}
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

        <TabsContent value="accounts" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {filteredAccounts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-lg">No accounts found</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Name</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Type</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Detail Type</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Tax</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">QuickBooks Balance</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide text-right">Bank Balance</TableHead>
                      <TableHead className="text-sm font-semibold uppercase tracking-wide">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((a) => (
                      <TableRow key={a.Id} className="text-sm">
                        <TableCell>
                          <div style={{ paddingLeft: `${a.depth * 24}px` }} className="flex items-center gap-2">
                            {a.AcctNum && <span className="text-xs text-muted-foreground font-mono">{a.AcctNum}</span>}
                            <span className={`font-medium ${a.depth === 0 ? "" : "text-muted-foreground"}`}>
                              {a.Name}
                            </span>
                            {!a.Active && (
                              <Badge variant="outline" className="text-xs ml-1">Inactive</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{a.AccountType}</TableCell>
                        <TableCell className="text-muted-foreground">{a.AccountSubType || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{(a as any).TaxCodeRef || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(a.CurrentBalance || 0)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {a.BankBalance != null ? fmt(a.BankBalance) : "—"}
                        </TableCell>
                        <TableCell>
                          <button
                            className="text-primary text-sm hover:underline cursor-pointer"
                            onClick={() => setSelectedAccount({ Id: a.Id, Name: a.Name, CurrentBalance: a.CurrentBalance || 0 })}
                          >
                            View register
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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

      <AccountQuickReportDrawer
        open={!!selectedAccount}
        onClose={() => setSelectedAccount(null)}
        account={selectedAccount}
        qbAction={data.qbAction}
      />

      <NewAccountDrawer
        open={newAccountOpen}
        onOpenChange={setNewAccountOpen}
        onSuccess={() => data.loadAll()}
      />
    </div>
  );
}

AccountingAccounts.displayName = "AccountingAccounts";
