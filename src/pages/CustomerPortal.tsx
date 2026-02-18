import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCustomerPortalData } from "@/hooks/useCustomerPortalData";
import { CustomerOrderList } from "@/components/customer-portal/CustomerOrderList";
import { CustomerDeliveryTracker } from "@/components/customer-portal/CustomerDeliveryTracker";
import { CustomerInvoiceList } from "@/components/customer-portal/CustomerInvoiceList";
import { CustomerDocuments } from "@/components/customer-portal/CustomerDocuments";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Truck, LogOut, Loader2, ShieldX, FileText, FileCheck } from "lucide-react";

export default function CustomerPortal() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { orders, deliveries, invoices, packingSlips, isLoading, hasAccess } = useCustomerPortalData();
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

  const outstandingBalance = invoices.reduce((s, i) => s + (i.balance || 0), 0);

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

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 sm:px-6 pt-4">
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setTab("orders")}>
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-muted-foreground uppercase">Active Orders</p>
            <p className="text-xl font-bold">{orders.filter(o => !["closed", "cancelled"].includes(o.status || "")).length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setTab("invoices")}>
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-muted-foreground uppercase">Outstanding</p>
            <p className="text-xl font-bold text-destructive">
              ${outstandingBalance.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setTab("deliveries")}>
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-muted-foreground uppercase">Deliveries</p>
            <p className="text-xl font-bold">{deliveries.length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setTab("documents")}>
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-muted-foreground uppercase">Documents</p>
            <p className="text-xl font-bold">{packingSlips.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 sm:px-6 pt-4">
          <TabsList>
            <TabsTrigger value="orders" className="gap-1.5">
              <Package className="w-4 h-4" />
              Orders ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1.5">
              <FileText className="w-4 h-4" />
              Invoices ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="deliveries" className="gap-1.5">
              <Truck className="w-4 h-4" />
              Deliveries ({deliveries.length})
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FileCheck className="w-4 h-4" />
              Documents ({packingSlips.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1 px-4 sm:px-6 py-4">
          <TabsContent value="orders" className="mt-0">
            <CustomerOrderList orders={orders} />
          </TabsContent>
          <TabsContent value="invoices" className="mt-0">
            <CustomerInvoiceList invoices={invoices} />
          </TabsContent>
          <TabsContent value="deliveries" className="mt-0">
            <CustomerDeliveryTracker deliveries={deliveries} />
          </TabsContent>
          <TabsContent value="documents" className="mt-0">
            <CustomerDocuments packingSlips={packingSlips} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
