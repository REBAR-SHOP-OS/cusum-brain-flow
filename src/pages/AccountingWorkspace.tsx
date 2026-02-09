import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
// Tabs removed — using dropdown nav menus instead
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, FileText, Receipt, CreditCard, Users,
  Landmark, ShieldCheck, Loader2, Plug, RefreshCw, Banknote,
  MessageCircle, X, ShieldAlert,
} from "lucide-react";
import { AccountingNavMenus } from "@/components/accounting/AccountingNavMenus";
import { useQuickBooksData } from "@/hooks/useQuickBooksData";
import { AccountingDashboard } from "@/components/accounting/AccountingDashboard";
import { AccountingInvoices } from "@/components/accounting/AccountingInvoices";
import { AccountingBills } from "@/components/accounting/AccountingBills";
import { AccountingPayments } from "@/components/accounting/AccountingPayments";
import { AccountingCustomers } from "@/components/accounting/AccountingCustomers";
import { AccountingAccounts } from "@/components/accounting/AccountingAccounts";
import { AccountingAudit } from "@/components/accounting/AccountingAudit";
import { AccountingPayroll } from "@/components/accounting/AccountingPayroll";
import { AccountingDocuments } from "@/components/accounting/AccountingDocuments";
import { AccountingReport } from "@/components/accounting/AccountingReport";
import { AccountingAgent } from "@/components/accounting/AccountingAgent";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useUserRole } from "@/hooks/useUserRole";
import accountingHelper from "@/assets/helpers/accounting-helper.png";

export default function AccountingWorkspace() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAgent, setShowAgent] = useState(false);
  const [agentMode, setAgentMode] = useState<"default" | "minimized" | "fullscreen">("default");
  const qb = useQuickBooksData();
  const { startOAuth } = useIntegrations();
  const { isAdmin, hasRole, isLoading: rolesLoading } = useUserRole();

  const hasAccess = isAdmin || hasRole("accounting");

  useEffect(() => {
    if (hasAccess) {
      qb.loadAll();
    }
  }, [hasAccess]);

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-lg text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg w-full">
          <CardContent className="p-10 text-center space-y-6">
            <div className="p-6 rounded-2xl bg-destructive/10 w-fit mx-auto">
              <ShieldAlert className="w-16 h-16 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold">Access Restricted</h1>
            <p className="text-lg text-muted-foreground">
              The Accounting workspace is restricted. Contact an admin if you need access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border gap-2 sm:gap-0 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2 shrink-0">
              💰 <span>Accounting</span>
            </h1>
            <AccountingNavMenus activeTab={activeTab} onNavigate={setActiveTab} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={showAgent ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setShowAgent(!showAgent)}
            >
              {showAgent ? <X className="w-4 h-4" /> : <img src={accountingHelper} alt="Penny" className="w-5 h-5 rounded-md object-cover" />}
              <span className="hidden sm:inline">{showAgent ? "Close Penny" : "Ask Penny"}</span>
              <span className="sm:hidden">{showAgent ? "Close" : "Penny"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => qb.loadAll()}
              disabled={qb.loading}
            >
              <RefreshCw className={`w-4 h-4 ${qb.loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh All</span>
              <span className="sm:hidden">Refresh</span>
            </Button>
          </div>
        </div>

      {/* Main content with optional agent panel */}
      <div className="flex-1 flex overflow-hidden">
        {!(showAgent && agentMode === "fullscreen") && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {activeTab === "dashboard" && <AccountingDashboard data={qb} onNavigate={setActiveTab} />}
            {activeTab === "invoices" && <AccountingInvoices data={qb} />}
            {activeTab === "bills" && <AccountingBills data={qb} />}
            {activeTab === "payments" && <AccountingPayments data={qb} />}
            {activeTab === "customers" && <AccountingCustomers data={qb} />}
            {activeTab === "accounts" && <AccountingAccounts data={qb} />}
            {activeTab === "audit" && <AccountingAudit data={qb} />}
            {activeTab === "payroll" && <AccountingPayroll data={qb} />}
            {activeTab === "documents" && <AccountingDocuments data={qb} />}
            {activeTab === "balance-sheet" && <AccountingReport data={qb} report="balance-sheet" />}
            {activeTab === "profit-loss" && <AccountingReport data={qb} report="profit-loss" />}
            {activeTab === "cash-flow" && <AccountingReport data={qb} report="cash-flow" />}
          </div>
        )}

        {/* Penny Agent Panel (side panel / fullscreen on desktop) */}
        {showAgent && (
          <div className={cn(
            "hidden lg:flex shrink-0 border-l border-border",
            agentMode === "fullscreen" ? "flex-1" : "w-[400px]",
            "p-3"
          )}>
            <div className="w-full">
              <AccountingAgent
                viewMode={agentMode}
                onViewModeChange={(m) => setAgentMode(m)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Penny Agent Panel (overlay on mobile) */}
      {showAgent && (
        <div className={cn(
          "lg:hidden fixed z-50",
          agentMode === "fullscreen" ? "inset-0 bg-background p-3" : "inset-x-3 bottom-3"
        )}>
          <AccountingAgent
            viewMode={agentMode}
            onViewModeChange={(m) => setAgentMode(m)}
          />
        </div>
      )}

      {/* Penny FAB (mobile, when agent is hidden) */}
      {!showAgent && (
        <button
          onClick={() => setShowAgent(true)}
          className="lg:hidden fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        >
          <img src={accountingHelper} alt="Penny" className="w-10 h-10 rounded-full object-cover" />
        </button>
      )}
    </div>
  );
}
