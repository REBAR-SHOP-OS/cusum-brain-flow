import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOrders } from "@/hooks/useOrders";
import { DollarSign, AlertTriangle, Clock } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function CashControl() {
  const { orders } = useOrders();

  const deliveredNotInvoiced = useMemo(
    () => orders.filter((o) => o.status === "delivered"),
    [orders]
  );

  const invoicedNotPaid = useMemo(
    () => orders.filter((o) => ["invoiced", "partially_paid"].includes(o.status || "")),
    [orders]
  );

  const deliveredValue = useMemo(
    () => deliveredNotInvoiced.reduce((s, o) => s + (o.total_amount || 0), 0),
    [deliveredNotInvoiced]
  );

  const invoicedValue = useMemo(
    () => invoicedNotPaid.reduce((s, o) => s + (o.total_amount || 0), 0),
    [invoicedNotPaid]
  );

  // Average days from delivered → invoiced (rough estimate from status timestamps)
  const avgDaysToInvoice = useMemo(() => {
    const invoiced = orders.filter((o) => ["invoiced", "paid", "partially_paid", "closed"].includes(o.status || ""));
    if (invoiced.length === 0) return null;
    const totalDays = invoiced.reduce((s, o) => {
      const created = new Date(o.created_at).getTime();
      const updated = new Date(o.updated_at).getTime();
      return s + (updated - created) / 86400000;
    }, 0);
    return Math.round(totalDays / invoiced.length);
  }, [orders]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <DollarSign className="w-4 h-4" /> Cash Control
      </h3>

      <div className="grid grid-cols-2 gap-2">
        <Card className={deliveredNotInvoiced.length > 0 ? "border-amber-300" : ""}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              {deliveredNotInvoiced.length > 0 && <AlertTriangle className="w-4 h-4 text-amber-500" />}
              <p className="text-xs text-muted-foreground">Delivered, Not Invoiced</p>
            </div>
            <p className="text-xl font-bold">{deliveredNotInvoiced.length}</p>
            <p className="text-xs text-muted-foreground">{fmt(deliveredValue)}</p>
          </CardContent>
        </Card>
        <Card className={invoicedNotPaid.length > 0 ? "border-orange-300" : ""}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              {invoicedNotPaid.length > 0 && <AlertTriangle className="w-4 h-4 text-orange-500" />}
              <p className="text-xs text-muted-foreground">Invoiced, Not Paid</p>
            </div>
            <p className="text-xl font-bold">{invoicedNotPaid.length}</p>
            <p className="text-xs text-muted-foreground">{fmt(invoicedValue)}</p>
          </CardContent>
        </Card>
      </div>

      {avgDaysToInvoice !== null && (
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xl font-bold">{avgDaysToInvoice} days</p>
              <p className="text-xs text-muted-foreground">Avg time to invoice</p>
            </div>
          </CardContent>
        </Card>
      )}

      {deliveredNotInvoiced.length === 0 && invoicedNotPaid.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-6">All clear — no outstanding items</p>
      )}
    </div>
  );
}
