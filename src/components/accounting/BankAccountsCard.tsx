import { useState } from "react";
import { ChevronDown, ChevronRight, Landmark } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import type { QBAccount } from "@/hooks/useQuickBooksData";
import type { BankFeedBalance } from "@/hooks/useBankFeedBalances";
import { format } from "date-fns";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

interface BankAccountsCardProps {
  accounts: QBAccount[];
  getBalance: (accountId: string) => BankFeedBalance | undefined;
  onNavigate: () => void;
}

export function BankAccountsCard({ accounts, getBalance, onNavigate }: BankAccountsCardProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="col-span-full rounded-lg border bg-card text-card-foreground shadow-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* Header */}
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 w-full px-5 py-4 text-left hover:bg-muted/40 transition-colors">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <Landmark className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold tracking-wide text-foreground uppercase">Banking Activity</h3>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <p className="px-5 pb-3 text-xs text-muted-foreground">
            Estimate the effort to bring these accounts up to date.
          </p>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                  Accounts ({accounts.length})
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground text-right">
                  Bank Balance
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground text-right">
                  In QuickBooks
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground text-right">
                  Unaccepted
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground text-right">
                  Unreconciled
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground text-right">
                  Reconciled Through
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const feed = getBalance(account.Id);
                const hasFeed = !!feed;

                return (
                  <TableRow
                    key={account.Id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={onNavigate}
                  >
                    {/* Account name */}
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                          <Landmark className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{account.Name}</p>
                          {!hasFeed && (
                            <p className="text-[11px] italic text-muted-foreground">
                              No bank data. QuickBooks transactions only.
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Bank Balance */}
                    <TableCell className="text-right text-sm tabular-nums font-medium">
                      {hasFeed ? fmt(feed.bank_balance) : <span className="text-muted-foreground">--</span>}
                    </TableCell>

                    {/* In QuickBooks */}
                    <TableCell className="text-right text-sm tabular-nums font-medium">
                      {fmt(account.CurrentBalance)}
                    </TableCell>

                    {/* Unaccepted */}
                    <TableCell className="text-right text-sm tabular-nums">
                      {hasFeed && feed.unaccepted_count != null ? (
                        <span className={feed.unaccepted_count > 0 ? "text-primary font-medium" : ""}>
                          {feed.unaccepted_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>

                    {/* Unreconciled */}
                    <TableCell className="text-right text-sm tabular-nums">
                      {feed?.unreconciled_count != null ? (
                        <span className={feed.unreconciled_count > 0 ? "text-primary font-medium" : ""}>
                          {feed.unreconciled_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>

                    {/* Reconciled Through */}
                    <TableCell className="text-right text-sm">
                      {feed?.reconciled_through ? (
                        <span className="tabular-nums">
                          {format(new Date(feed.reconciled_through), "MM/dd/yyyy")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Never reconciled</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

BankAccountsCard.displayName = "BankAccountsCard";
