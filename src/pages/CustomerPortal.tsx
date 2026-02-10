import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCustomerPortalData } from "@/hooks/useCustomerPortalData";
import { CustomerOrderList } from "@/components/customer-portal/CustomerOrderList";
import { CustomerDeliveryTracker } from "@/components/customer-portal/CustomerDeliveryTracker";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Package, Truck, LogOut, Loader2, ShieldX } from "lucide-react";

export default function CustomerPortal() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { orders, deliveries, isLoading, hasAccess } = useCustomerPortalData();
  const [tab, setTab] = useState("orders");

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading portal...
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <ShieldX className="w-12 h-12 mx-auto mb-4 text-destructive/60" />
          <h2 className="text-lg font-semibold mb-1">No Access</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Your account is not linked to a customer record. Please contact support.
          </p>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Customer Portal</h1>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </header>

      {/* Content */}
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 sm:px-6 pt-4">
          <TabsList>
            <TabsTrigger value="orders" className="gap-1.5">
              <Package className="w-4 h-4" />
              Orders ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="gap-1.5">
              <Truck className="w-4 h-4" />
              Deliveries ({deliveries.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1 px-4 sm:px-6 py-4">
          <TabsContent value="orders" className="mt-0">
            <CustomerOrderList orders={orders} />
          </TabsContent>
          <TabsContent value="deliveries" className="mt-0">
            <CustomerDeliveryTracker deliveries={deliveries} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
