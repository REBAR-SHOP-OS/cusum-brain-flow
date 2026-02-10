import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Calendar } from "lucide-react";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  confirmed: "bg-blue-500/20 text-blue-500",
  in_production: "bg-yellow-500/20 text-yellow-500",
  ready: "bg-green-500/20 text-green-500",
  delivered: "bg-green-500/20 text-green-500",
  cancelled: "bg-destructive/20 text-destructive",
};

interface Order {
  id: string;
  order_number: string;
  status: string;
  order_date: string | null;
  required_date: string | null;
  total_amount: number | null;
  notes: string | null;
}

export function CustomerOrderList({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Package className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No orders found</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {orders.map((order) => {
        const status = (order.status || "draft").toLowerCase();
        return (
          <Card key={order.id} className="hover:bg-muted/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">{order.order_number}</span>
                <Badge className={statusColors[status] || statusColors.draft}>
                  {status.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {order.order_date
                    ? format(new Date(order.order_date), "MMM d, yyyy")
                    : "No date"}
                </div>
                {order.total_amount != null && (
                  <span className="font-medium text-foreground">
                    ${order.total_amount.toLocaleString()}
                  </span>
                )}
              </div>
              {order.required_date && (
                <p className="text-xs text-primary/70 mt-1">
                  Required by {format(new Date(order.required_date), "MMM d, yyyy")}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
