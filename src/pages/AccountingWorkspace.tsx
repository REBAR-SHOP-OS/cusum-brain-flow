import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, FileText, Receipt, CreditCard, Users,
  Landmark, ShieldCheck, Loader2, Plug, RefreshCw, Banknote,
} from "lucide-react";
import { useQuickBooksData } from "@/hooks/useQuickBooksData";
import { AccountingDashboard } from "@/components/accounting/AccountingDashboard";
import { AccountingInvoices } from "@/components/accounting/AccountingInvoices";
import { AccountingBills } from "@/components/accounting/AccountingBills";
import { AccountingPayments } from "@/components/accounting/AccountingPayments";
import { AccountingCustomers } from "@/components/accounting/AccountingCustomers";
import { AccountingAccounts } from "@/components/accounting/AccountingAccounts";
import { AccountingAudit } from "@/components/accounting/AccountingAudit";
import { AccountingPayroll } from "@/components/accounting/AccountingPayroll";
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border gap-2 sm:gap-0 shrink-0">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
            💰 <span className="truncate">Accounting</span>
            <Badge variant="outline" className="text-xs sm:text-sm font-normal shrink-0">QuickBooks</Badge>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1 hidden sm:block">Everything you need. Click and confirm. Simple.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => qb.loadAll()}
          disabled={qb.loading}
        >
          <RefreshCw className={`w-4 h-4 ${qb.loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh All</span>
          <span className="sm:hidden">Refresh</span>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin border-b border-border shrink-0">
          <TabsList className="h-12 sm:h-14 inline-flex w-max min-w-full gap-0.5 sm:gap-1 bg-muted/50 p-1 rounded-none">
            <TabsTrigger value="dashboard" className="text-xs sm:text-base h-9 sm:h-11 gap-1.5 sm:gap-2 px-3 sm:px-4 shrink-0">
              <LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">Dashboard</span><span className="sm:hidden">Home</span>
            </TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs sm:text-base h-9 sm:h-11 gap-1.5 sm:gap-2 px-3 sm:px-4 shrink-0">
              <FileText className="w-4 h-4" /> Invoices
              {qb.overdueInvoices.length > 0 && (
                <Badge variant="destructive" className="ml-0.5 text-xs">{qb.overdueInvoices.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bills" className="text-xs sm:text-base h-9 sm:h-11 gap-1.5 sm:gap-2 px-3 sm:px-4 shrink-0">
              <Receipt className="w-4 h-4" /> Bills
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-base h-9 sm:h-11 gap-1.5 sm:gap-2 px-3 sm:px-4 shrink-0">
              <CreditCard className="w-4 h-4" /> Payments
            </TabsTrigger>
            <TabsTrigger value="customers" className="text-xs sm:text-base h-9 sm:h-11 gap-1.5 sm:gap-2 px-3 sm:px-4 shrink-0">
              <Users className="w-4 h-4" /> Customers
            </TabsTrigger>
            <TabsTrigger value="accounts" className="text-xs sm:text-base h-9 sm:h-11 gap-1.5 sm:gap-2 px-3 sm:px-4 shrink-0">
              <Landmark className="w-4 h-4" /> Accounts
            </TabsTrigger>
            <TabsTrigger value="payroll" className="text-xs sm:text-base h-9 sm:h-11 gap-1.5 sm:gap-2 px-3 sm:px-4 shrink-0">
              <Banknote className="w-4 h-4" /> Payroll
              {qb.employees.length > 0 && (
                <Badge variant="outline" className="ml-0.5 text-xs">{qb.employees.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit" className="text-xs sm:text-base h-9 sm:h-11 gap-1.5 sm:gap-2 px-3 sm:px-4 shrink-0">
              <ShieldCheck className="w-4 h-4" /> AI Audit
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
          <TabsContent value="payroll">
            <AccountingPayroll data={qb} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
