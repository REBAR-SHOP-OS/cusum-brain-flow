import { useState } from "react";
import { usePickupOrders, usePickupOrderItems } from "@/hooks/usePickupOrders";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { PickupVerification } from "@/components/shopfloor/PickupVerification";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, MapPin } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  ready: "bg-success/20 text-success",
  collected: "bg-primary/20 text-primary",
  released: "bg-warning/20 text-warning",
};

export default function PickupStation() {
  const { user } = useAuth();
  const { orders, loading, authorizeRelease } = usePickupOrders();
  const { isAdmin, isWorkshop } = useUserRole();
  const canWrite = isAdmin || isWorkshop;

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || null;
  const { items, toggleVerified } = usePickupOrderItems(selectedOrderId);

  if (selectedOrder) {
    return (
      <PickupVerification
        order={selectedOrder}
        items={items}
        onToggleVerified={toggleVerified}
        onAuthorize={async (sig) => {
          if (user) {
            await authorizeRelease(selectedOrder.id, sig, user.id);
            setSelectedOrderId(null);
          }
        }}
        onBack={() => setSelectedOrderId(null)}
        canWrite={canWrite}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-wide uppercase">Pickup Station</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verify identity and authorize material release
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
            <Package className="w-10 h-10" />
            <p>No pickup orders found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => (
              <Card
                key={order.id}
                className="cursor-pointer hover:border-primary/40 transition-all"
                onClick={() => setSelectedOrderId(order.id)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold text-sm uppercase">
                        {order.site_address}
                      </span>
                    </div>
                    <Badge className={statusColors[order.status] || statusColors.pending}>
                      {order.status.toUpperCase()}
                    </Badge>
                  </div>

                  {order.customer && (
                    <p className="text-xs text-muted-foreground">
                      {order.customer.company_name || order.customer.name}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono">{order.bundle_count} Bundles</span>
                    <span>For Collection</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
