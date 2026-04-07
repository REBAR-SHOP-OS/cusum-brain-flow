import { useState } from "react";
import { Landmark, RefreshCw, Link2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useBankConnections } from "@/hooks/useBankConnections";
import { PlaidLinkButton } from "./PlaidLinkButton";
import { format } from "date-fns";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

export function PlaidBankSection() {
  const { connections, loading, hasConnections, refreshBalances, fetchConnections } = useBankConnections();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshBalances();
      toast.success("Bank balances updated");
    } catch (err: any) {
      toast.error(`Refresh failed: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold tracking-wide uppercase">Direct Bank Connection (Plaid)</h3>
          <Badge variant="outline" className="text-[10px]">READ-ONLY</Badge>
        </div>
        <div className="flex items-center gap-2">
          {hasConnections && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              Refresh Balances
            </Button>
          )}
          <PlaidLinkButton onSuccess={fetchConnections} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Connect your bank for real-time balance visibility. This is read-only — QuickBooks remains the accounting authority. No conflicts.
      </p>

      {loading ? (
        <div className="text-xs text-muted-foreground py-4 text-center">Loading connections…</div>
      ) : connections.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md">
          No bank accounts connected. Click "Connect Bank Account" to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between p-3 rounded-md border bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <Landmark className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {conn.account_name || "Account"}{" "}
                    {conn.account_mask && (
                      <span className="text-muted-foreground">••{conn.account_mask}</span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {conn.institution_name} · {conn.account_type}
                    {conn.linked_qb_account_id && (
                      <span className="ml-2 text-primary">
                        <Link2 className="w-3 h-3 inline mr-0.5" />
                        Linked to QB
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {conn.last_balance != null ? (
                  <p className="text-sm font-semibold tabular-nums">{fmt(conn.last_balance)}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">--</p>
                )}
                {conn.last_balance_sync && (
                  <p className="text-[10px] text-muted-foreground">
                    {format(new Date(conn.last_balance_sync), "MMM d, h:mm a")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
