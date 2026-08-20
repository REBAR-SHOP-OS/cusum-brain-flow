import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useVendorPortalData } from "@/hooks/useVendorPortalData";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, CreditCard, Package, LogOut, Loader2, ShieldX } from "lucide-react";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export default function VendorPortal() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { vendor, bills, payments, purchaseOrders, isLoading, hasAccess } = useVendorPortalData();
  const [tab, setTab] = useState("bills");

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading vendor portal...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <ShieldX className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Access Denied</h2>
            <p className="text-muted-foreground">Your account is not linked to a vendor. Contact your administrator.</p>
            <Button variant="outline" onClick={signOut}>Sign Out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalBillsOwed = bills.reduce((s, b) => s + (b.balance || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + ((p.data as any)?.TotalAmt || 0), 0);
  const openBills = bills.filter(b => (b.balance || 0) > 0).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Vendor Portal</h1>
          <p className="text-xs text-muted-foreground">{vendor?.name || user.email}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 sm:p-6">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Outstanding Balance</p>
            <p className="text-2xl font-bold">{fmt(totalBillsOwed)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Open Bills</p>
            <p className="text-2xl font-bold">{openBills}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
            <p className="text-2xl font-bold">{fmt(totalPaid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 pb-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="bills" className="gap-2"><FileText className="w-4 h-4" /> Bills ({bills.length})</TabsTrigger>
            <TabsTrigger value="payments" className="gap-2"><CreditCard className="w-4 h-4" /> Payments ({payments.length})</TabsTrigger>
            <TabsTrigger value="purchase-orders" className="gap-2"><Package className="w-4 h-4" /> POs ({purchaseOrders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="mt-4">
            {bills.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No bills found.</p>
            ) : (
              <div className="space-y-2">
                {bills.map(bill => {
                  const d = bill.data as any;
                  return (
                    <Card key={bill.id}>
                      <CardContent className="py-3 px-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Bill #{d?.DocNumber || bill.quickbooks_id}</p>
                          <p className="text-xs text-muted-foreground">
                            {d?.TxnDate || "—"} · Due: {d?.DueDate || "—"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{fmt(d?.TotalAmt || 0)}</p>
                          <Badge variant={(bill.balance || 0) > 0 ? "destructive" : "secondary"} className="text-xs">
                            {(bill.balance || 0) > 0 ? `${fmt(bill.balance || 0)} due` : "Paid"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            {payments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No payments found.</p>
            ) : (
              <div className="space-y-2">
                {payments.map(pmt => {
                  const d = pmt.data as any;
                  return (
                    <Card key={pmt.id}>
                      <CardContent className="py-3 px-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">Payment #{d?.DocNumber || pmt.quickbooks_id}</p>
                          <p className="text-xs text-muted-foreground">{d?.TxnDate || "—"}</p>
                        </div>
                        <p className="font-semibold text-sm">{fmt(d?.TotalAmt || 0)}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="purchase-orders" className="mt-4">
            {purchaseOrders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No purchase orders found.</p>
            ) : (
              <div className="space-y-2">
                {purchaseOrders.map((po: any) => (
                  <Card key={po.id}>
                    <CardContent className="py-3 px-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">PO #{po.po_number || po.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{po.created_at?.split("T")[0] || "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">{fmt(po.total_amount || 0)}</p>
                        <Badge variant="outline" className="text-xs">{po.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
