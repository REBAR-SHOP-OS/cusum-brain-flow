import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Landmark, ChevronDown, Settings, MoreVertical, Info, CheckCircle2 } from "lucide-react";
import type { QBAccount } from "@/hooks/useQuickBooksData";
import type { BankFeedBalance } from "@/hooks/useBankFeedBalances";
import { formatDistanceToNow } from "date-fns";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

interface BankAccountsCardProps {
  accounts: QBAccount[];
  getBalance: (accountId: string) => BankFeedBalance | undefined;
  onNavigate: () => void;
}

export function BankAccountsCard({ accounts, getBalance, onNavigate }: BankAccountsCardProps) {
  // Total: prefer bank feed balance, fall back to QB book balance
  const totalBankBalance = accounts.reduce((sum, a) => {
    const feed = getBalance(a.Id);
    return sum + (feed ? feed.bank_balance : a.CurrentBalance);
  }, 0);

  return (
    <Card className="col-span-1">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Bank Accounts</h3>
          <span className="text-xs text-muted-foreground">As of today</span>
        </div>

        {/* Summary */}
        <div className="px-5 pb-4 border-b">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
            Today's bank balance
            <Info className="w-3 h-3" />
          </div>
          <span className="text-2xl font-bold tabular-nums">{fmt(totalBankBalance)}</span>
        </div>

        {/* Account rows */}
        <div className="divide-y">
          {accounts.map((account) => {
            const feed = getBalance(account.Id);
            return (
              <div key={account.Id} className="flex items-start gap-3 px-5 py-3">
                {/* Icon */}
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                  <Landmark className="w-4 h-4 text-primary" />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate uppercase">{account.Name}</p>

                  {feed ? (
                    <div className="space-y-0.5 mt-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Bank balance</span>
                        <span className="tabular-nums font-medium">{fmt(feed.bank_balance)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">In QuickBooks</span>
                        <span className="tabular-nums font-medium">{fmt(account.CurrentBalance)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {feed.last_updated && (
                          <span className="text-[10px] text-muted-foreground">
                            Updated {formatDistanceToNow(new Date(feed.last_updated), { addSuffix: true })}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3" /> Reviewed
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-muted-foreground">In QuickBooks</span>
                      <span className="tabular-nums font-medium">{fmt(account.CurrentBalance)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t">
          <Button
            variant="link"
            size="sm"
            className="text-xs text-primary p-0 h-auto gap-1"
            onClick={(e) => { e.stopPropagation(); onNavigate(); }}
          >
            Go to registers <ChevronDown className="w-3 h-3" />
          </Button>
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
            <MoreVertical className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

BankAccountsCard.displayName = "BankAccountsCard";
