import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Circle } from "lucide-react";
import type { SourceSummary, ReconciliationIndicator } from "@/hooks/usePaymentSources";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const SOURCE_STYLES: Record<string, { border: string; icon: string; dot: string }> = {
  quickbooks: { border: "border-success/30", icon: "text-success", dot: "bg-success" },
  stripe: { border: "border-purple-400/30", icon: "text-purple-500", dot: "bg-purple-500" },
  bmo: { border: "border-blue-400/30", icon: "text-blue-500", dot: "bg-blue-500" },
  odoo: { border: "border-muted-foreground/30", icon: "text-muted-foreground", dot: "bg-muted-foreground" },
};

const STATUS_LABEL: Record<string, string> = {
  connected: "Connected",
  synced: "Synced",
  archived: "Archived",
  disconnected: "Disconnected",
};

interface Props {
  summaries: SourceSummary[];
  reconciliation: ReconciliationIndicator[];
}

export function PaymentSourceStrip({ summaries, reconciliation }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaries.map((s) => {
          const style = SOURCE_STYLES[s.source] ?? SOURCE_STYLES.odoo;
          return (
            <Card key={s.source} className={`${style.border} bg-card`}>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{s.label}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`w-2 h-2 rounded-full ${style.dot} ${s.status === "disconnected" ? "opacity-30" : ""}`} />
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
                <p className={`text-xl font-bold ${style.icon}`}>
                  {s.source === "odoo" && s.count === 0 ? "Legacy" : fmt(s.total)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.source === "bmo"
                    ? `${s.count} account(s) · Ledger Bal`
                    : s.source === "odoo"
                    ? s.count > 0
                      ? `${s.count} archived order(s)`
                      : "Detached"
                    : `${s.count} payment(s)`}
                </p>
                {s.lastSync && (
                  <p className="text-[10px] text-muted-foreground">
                    Last sync: {new Date(s.lastSync).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {reconciliation.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {reconciliation.map((r) => (
            <Badge
              key={r.pair}
              variant="outline"
              className={`gap-1.5 text-xs px-3 py-1 ${
                r.balanced
                  ? "text-success border-success/30"
                  : "text-warning border-warning/30"
              }`}
            >
              {r.balanced ? (
                <CheckCircle className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              {r.pair}: {r.detail}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
