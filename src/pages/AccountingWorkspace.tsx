import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, FileText, Receipt, CreditCard, Users,
  Landmark, ShieldCheck, Loader2, Plug, RefreshCw,
} from "lucide-react";
import { useQuickBooksData } from "@/hooks/useQuickBooksData";
import { AccountingDashboard } from "@/components/accounting/AccountingDashboard";
import { AccountingInvoices } from "@/components/accounting/AccountingInvoices";
import { AccountingBills } from "@/components/accounting/AccountingBills";
import { AccountingPayments } from "@/components/accounting/AccountingPayments";
import { AccountingCustomers } from "@/components/accounting/AccountingCustomers";
import { AccountingAccounts } from "@/components/accounting/AccountingAccounts";
import { AccountingAudit } from "@/components/accounting/AccountingAudit";
import { useIntegrations } from "@/hooks/useIntegrations";

export default function AccountingWorkspace() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const qb = useQuickBooksData();
  const { startOAuth } = useIntegrations();

  useEffect(() => {
    qb.loadAll();
  }, []);

  if (qb.connected === false) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg w-full">
          <CardContent className="p-10 text-center space-y-6">
            <div className="p-6 rounded-2xl bg-primary/10 w-fit mx-auto">
              <Plug className="w-16 h-16 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Connect QuickBooks First</h1>
            <p className="text-lg text-muted-foreground">
              To use the Accounting Workspace, connect your QuickBooks account.
              All data stays secure and private to your account.
            </p>
            <Button
              size="lg"
              className="h-14 text-lg px-8"
              onClick={() => startOAuth("quickbooks")}
            >
              <Plug className="w-5 h-5 mr-2" />
              Connect QuickBooks
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (qb.loading && qb.connected === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-lg text-muted-foreground">Loading your accounting data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            💰 Accounting Workspace
            <Badge variant="outline" className="text-sm font-normal">QuickBooks</Badge>
          </h1>
          <p className="text-muted-foreground mt-1">Everything you need. Click and confirm. Simple.</p>
        </div>
        <Button
          variant="outline"
          size="lg"
          className="h-12 gap-2"
          onClick={() => qb.loadAll()}
          disabled={qb.loading}
        >
          <RefreshCw className={`w-5 h-5 ${qb.loading ? "animate-spin" : ""}`} />
          Refresh All
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-14 w-full flex flex-wrap gap-1 bg-muted/50 p-1">
          <TabsTrigger value="dashboard" className="text-base h-11 gap-2 flex-1 min-w-[120px]">
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-base h-11 gap-2 flex-1 min-w-[100px]">
            <FileText className="w-5 h-5" /> Invoices
            {qb.overdueInvoices.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">{qb.overdueInvoices.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bills" className="text-base h-11 gap-2 flex-1 min-w-[100px]">
            <Receipt className="w-5 h-5" /> Bills
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-base h-11 gap-2 flex-1 min-w-[100px]">
            <CreditCard className="w-5 h-5" /> Payments
          </TabsTrigger>
          <TabsTrigger value="customers" className="text-base h-11 gap-2 flex-1 min-w-[100px]">
            <Users className="w-5 h-5" /> Customers
          </TabsTrigger>
          <TabsTrigger value="accounts" className="text-base h-11 gap-2 flex-1 min-w-[100px]">
            <Landmark className="w-5 h-5" /> Accounts
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-base h-11 gap-2 flex-1 min-w-[100px]">
            <ShieldCheck className="w-5 h-5" /> AI Audit
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="dashboard">
            <AccountingDashboard data={qb} onNavigate={setActiveTab} />
          </TabsContent>
          <TabsContent value="invoices">
            <AccountingInvoices data={qb} />
          </TabsContent>
          <TabsContent value="bills">
            <AccountingBills data={qb} />
          </TabsContent>
          <TabsContent value="payments">
            <AccountingPayments data={qb} />
          </TabsContent>
          <TabsContent value="customers">
            <AccountingCustomers data={qb} />
          </TabsContent>
          <TabsContent value="accounts">
            <AccountingAccounts data={qb} />
          </TabsContent>
          <TabsContent value="audit">
            <AccountingAudit data={qb} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
