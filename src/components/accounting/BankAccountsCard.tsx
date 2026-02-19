import { useState } from "react";
import { ChevronDown, ChevronRight, Landmark, Pencil, Check, X, Plus, RefreshCw } from "lucide-react";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { QBAccount } from "@/hooks/useQuickBooksData";
import type { QBBankActivity } from "@/hooks/useQBBankActivity";
import { format } from "date-fns";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

interface BankAccountsCardProps {
  accounts: QBAccount[];
  getActivity: (qbAccountId: string) => QBBankActivity | undefined;
  upsertBankBalance: (qbAccountId: string, accountName: string, bankBalance: number) => Promise<any>;
  onNavigate: () => void;
  onSync: () => Promise<any>;
  syncing: boolean;
}

export function BankAccountsCard({ accounts, getActivity, upsertBankBalance, onNavigate, onSync, syncing }: BankAccountsCardProps) {
  const [open, setOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (account: QBAccount, currentBalance?: number | null) => {
    setEditingId(account.Id);
    setEditValue(currentBalance != null ? String(currentBalance) : String(account.CurrentBalance));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (account: QBAccount) => {
    const parsed = parseFloat(editValue);
    if (isNaN(parsed)) return;
    await upsertBankBalance(account.Id, account.Name, parsed);
    setEditingId(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, account: QBAccount) => {
    if (e.key === "Enter") saveEdit(account);
    if (e.key === "Escape") cancelEdit();
  };

  return (
    <div className="col-span-full rounded-lg border bg-card text-card-foreground shadow-sm">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 w-full px-5 py-4 text-left hover:bg-muted/40 transition-colors">
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            <Landmark className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold tracking-wide text-foreground uppercase">Banking Activity</h3>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="flex items-center justify-between px-5 pb-3">
            <p className="text-xs text-muted-foreground">
              Synced from QuickBooks. Bank balance is manual entry.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={(e) => { e.stopPropagation(); onSync(); }}
              disabled={syncing}
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync QB"}
            </Button>
          </div>

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
                  Unreconciled
                </TableHead>
                <TableHead className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground text-right">
                  Reconciled Through
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const activity = getActivity(account.Id);
                const isEditing = editingId === account.Id;

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
                          {!activity?.last_qb_sync_at && (
                            <p className="text-[11px] italic text-muted-foreground">
                              Not yet synced. Click "Sync QB" to pull data.
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Bank Balance - inline editable (manual entry) */}
                    <TableCell className="text-right text-sm tabular-nums font-medium" onClick={(e) => e.stopPropagation()}>
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, account)}
                            className="w-28 h-7 text-right text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(account)}
                            className="p-1 rounded hover:bg-primary/10 text-primary"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 group">
                          {activity?.bank_balance != null ? (
                            <span>{fmt(activity.bank_balance)}</span>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                          <button
                            onClick={() => startEdit(account, activity?.bank_balance)}
                            className="p-1 rounded hover:bg-primary/10 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Edit bank balance"
                          >
                            {activity?.bank_balance != null ? (
                              <Pencil className="w-3 h-3" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </TableCell>

                    {/* In QuickBooks (ledger balance from QB sync) */}
                    <TableCell className="text-right text-sm tabular-nums font-medium">
                      {activity ? fmt(activity.ledger_balance) : fmt(account.CurrentBalance)}
                    </TableCell>

                    {/* Unreconciled (from QB report sync) */}
                    <TableCell className="text-right text-sm tabular-nums">
                      {activity?.last_qb_sync_at ? (
                        <span className={activity.unreconciled_count > 0 ? "text-primary font-medium" : ""}>
                          {activity.unreconciled_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>

                    {/* Reconciled Through (from QB report sync) */}
                    <TableCell className="text-right text-sm">
                      {activity?.reconciled_through_date ? (
                        <span className="tabular-nums">
                          {format(new Date(activity.reconciled_through_date), "MM/dd/yyyy")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">
                          {activity?.last_qb_sync_at ? "Never reconciled" : "--"}
                        </span>
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
