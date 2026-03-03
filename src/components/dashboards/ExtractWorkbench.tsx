import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOrders } from "@/hooks/useOrders";
import { FileText, Clock, DollarSign, AlertTriangle } from "lucide-react";

const EXTRACT_STATUSES = ["extract_new", "needs_customer", "needs_scope_confirm", "needs_pricing", "quote_ready", "quote_sent"];

function ageBucket(createdAt: string): string {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  if (hours < 2) return "0–2h";
  if (hours < 8) return "2–8h";
  if (hours < 24) return "8–24h";
  return "24h+";
}

const BUCKET_COLORS: Record<string, string> = {
  "0–2h": "bg-green-500/10 text-green-700",
  "2–8h": "bg-amber-500/10 text-amber-700",
  "8–24h": "bg-orange-500/10 text-orange-700",
  "24h+": "bg-red-500/10 text-red-700",
};

export function ExtractWorkbench() {
  const { orders } = useOrders();

  const extracts = useMemo(() => orders.filter((o) => o.order_kind === "extract"), [orders]);

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    EXTRACT_STATUSES.forEach((s) => (map[s] = 0));
    extracts.forEach((o) => {
      if (o.status && map[o.status] !== undefined) map[o.status]++;
    });
    return map;
  }, [extracts]);

  const buckets = useMemo(() => {
    const map: Record<string, number> = { "0–2h": 0, "2–8h": 0, "8–24h": 0, "24h+": 0 };
    extracts.forEach((o) => {
      const b = ageBucket(o.created_at);
      map[b]++;
    });
    return map;
  }, [extracts]);

  const pipeline = useMemo(
    () => extracts.reduce((s, o) => s + (o.expected_value || 0), 0),
    [extracts]
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <FileText className="w-4 h-4" /> Extract Workbench
      </h3>

      {/* Status counts */}
      <div className="grid grid-cols-3 gap-2">
        {EXTRACT_STATUSES.map((s) => (
          <Card key={s}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{byStatus[s]}</p>
              <p className="text-[10px] text-muted-foreground">{s.replace(/_/g, " ")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Aging buckets */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Aging
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          {Object.entries(buckets).map(([label, count]) => (
            <Badge key={label} variant="outline" className={`text-xs px-2 py-1 ${BUCKET_COLORS[label]}`}>
              {label}: {count}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {/* Pipeline */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-primary" />
          <div>
            <p className="text-xl font-bold">{fmt(pipeline)}</p>
            <p className="text-xs text-muted-foreground">Pipeline (expected value)</p>
          </div>
        </CardContent>
      </Card>

      {extracts.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-6">No extract orders</p>
      )}
    </div>
  );
}
