import { useState, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { usePickupOrders, usePickupOrderItems } from "@/hooks/usePickupOrders";
import { useCompletedBundles, type CompletedBundle } from "@/hooks/useCompletedBundles";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/lib/auth";
import { PickupVerification } from "@/components/shopfloor/PickupVerification";
import { ReadyBundleList } from "@/components/dispatch/ReadyBundleList";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Package, MapPin, ArrowLeft, AlertTriangle } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  ready: "bg-success/20 text-success",
  collected: "bg-primary/20 text-primary",
  released: "bg-warning/20 text-warning",
};

const PickupStation = forwardRef<HTMLDivElement>(function PickupStation(_props, ref) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders, loading, error, authorizeRelease } = usePickupOrders();
  const { isAdmin, isWorkshop } = useUserRole();
  const canWrite = isAdmin || isWorkshop;

  const { bundles } = useCompletedBundles();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<CompletedBundle | null>(null);
  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || null;
  const { items, toggleVerified } = usePickupOrderItems(selectedOrderId);

  if (selectedBundle) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setSelectedBundle(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{selectedBundle.projectName}</h1>
            <p className="text-xs text-muted-foreground">{selectedBundle.planName} • {selectedBundle.items.length} items • {selectedBundle.totalPieces} pcs</p>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="grid gap-3">
            {selectedBundle.items.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{item.mark_number || "No mark"}</span>
                    <p className="text-xs text-muted-foreground">{item.cut_length_mm}mm • {item.total_pieces} pcs</p>
                  </div>
                  <Badge variant="outline">{item.bar_code}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

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

  // Fix 4: Error state
  if (error) {
    return (
      <div className="text-center py-20 text-destructive">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-60" />
        <p className="text-sm">Failed to load pickup orders</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/shop-floor")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-wide uppercase">Pickup Station</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verify identity and authorize material release
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {/* Ready bundles from clearance */}
        <ReadyBundleList
          bundles={bundles}
          title="Cleared — Ready for Pickup"
          onSelect={setSelectedBundle}
        />

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 && bundles.length === 0 ? (
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
});

export default PickupStation;
