import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2, Plug, RefreshCw,
  X, ShieldAlert, AlertTriangle,
} from "lucide-react";
import { AccountingNavMenus } from "@/components/accounting/AccountingNavMenus";
import { useQuickBooksData } from "@/hooks/useQuickBooksData";
import { AccountingDashboard } from "@/components/accounting/AccountingDashboard";
import { AccountingInvoices } from "@/components/accounting/AccountingInvoices";
import { AccountingBills } from "@/components/accounting/AccountingBills";
import { AccountingPayments } from "@/components/accounting/AccountingPayments";
import { AccountingCustomers } from "@/components/accounting/AccountingCustomers";
import { AccountingVendors } from "@/components/accounting/AccountingVendors";
import { AccountingAccounts } from "@/components/accounting/AccountingAccounts";
import { AccountingAudit } from "@/components/accounting/AccountingAudit";
import { AccountingPayroll } from "@/components/accounting/AccountingPayroll";
import { AccountingDocuments } from "@/components/accounting/AccountingDocuments";
import { AccountingReport } from "@/components/accounting/AccountingReport";
import { AccountingAgedReceivables } from "@/components/accounting/AccountingAgedReceivables";
import { AccountingAgedPayables } from "@/components/accounting/AccountingAgedPayables";
import { AccountingQBReport } from "@/components/accounting/AccountingQBReport";
import { AccountingAgent } from "@/components/accounting/AccountingAgent";
import { PayrollAuditView } from "@/components/office/PayrollAuditView";
import { AccountingOrders } from "@/components/accounting/AccountingOrders";
import { AccountingActionQueue } from "@/components/accounting/AccountingActionQueue";
import { AccountingVendorPayments } from "@/components/accounting/AccountingVendorPayments";
import { BudgetManagement } from "@/components/accounting/BudgetManagement";
import { QuoteTemplateManager } from "@/components/accounting/QuoteTemplateManager";
import { ExpenseClaimsManager } from "@/components/accounting/ExpenseClaimsManager";
import { ThreeWayMatchingManager } from "@/components/accounting/ThreeWayMatchingManager";
import { EmployeeContractsManager } from "@/components/accounting/EmployeeContractsManager";
import { RecruitmentPipeline } from "@/components/accounting/RecruitmentPipeline";
import { ProjectManagement } from "@/components/accounting/ProjectManagement";
import { AccountingSalesReceipts } from "@/components/accounting/AccountingSalesReceipts";
import { AccountingRefundReceipts } from "@/components/accounting/AccountingRefundReceipts";
import { AccountingDeposits } from "@/components/accounting/AccountingDeposits";
import { AccountingTransfers } from "@/components/accounting/AccountingTransfers";
import { AccountingJournalEntries } from "@/components/accounting/AccountingJournalEntries";
import { AccountingRecurring } from "@/components/accounting/AccountingRecurring";
import { AccountingBatchActions } from "@/components/accounting/AccountingBatchActions";
import { AccountingStatements } from "@/components/accounting/AccountingStatements";
import { AccountingExpenses } from "@/components/accounting/AccountingExpenses";
import { AccountingAttachments } from "@/components/accounting/AccountingAttachments";
import { AccountingReconciliation } from "@/components/accounting/AccountingReconciliation";
import { AccountingScheduledReports } from "@/components/accounting/AccountingScheduledReports";
import { AccountingRecurringTxns } from "@/components/accounting/AccountingRecurringTxns";
import { TaxPlanning } from "@/components/accounting/TaxPlanning";
import { BudgetVsActuals } from "@/components/accounting/BudgetVsActuals";

import { usePennyQueue } from "@/hooks/usePennyQueue";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useUserRole } from "@/hooks/useUserRole";
import { useWebPhone } from "@/hooks/useWebPhone";
import accountingHelper from "@/assets/helpers/accounting-helper.png";

/* ── Constants ── */
const QB_LAST_LOAD_KEY = "qb-last-load-date";
const QB_LAST_LOAD_TIME_KEY = "qb-last-load-time";

/* ── Draggable Penny FAB ── */
const PENNY_STORAGE_KEY = "penny-btn-pos";
const FAB_SIZE = 56;
const DRAG_THRESHOLD = 5;

function clampPos(x: number, y: number) {
  const maxX = window.innerWidth - FAB_SIZE;
  const maxY = window.innerHeight - FAB_SIZE;
  return { x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) };
}

function PennyFab({ showAgent, onToggle }: { showAgent: boolean; onToggle: () => void }) {
  const [pos, setPos] = useState(() => {
    try {
      const raw = localStorage.getItem(PENNY_STORAGE_KEY);
      if (raw) { const p = JSON.parse(raw); if (typeof p.x === "number") return p; }
    } catch {}
    return { x: window.innerWidth - FAB_SIZE - 24, y: window.innerHeight - FAB_SIZE - 24 };
  });
  const dragging = useRef(false);
  const startPtr = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  useEffect(() => {
    const onResize = () => setPos((p: { x: number; y: number }) => clampPos(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true; moved.current = false;
    startPtr.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...pos };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startPtr.current.x;
    const dy = e.clientY - startPtr.current.y;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) moved.current = true;
    setPos(clampPos(startPos.current.x + dx, startPos.current.y + dy));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    if (moved.current) {
      const final = clampPos(startPos.current.x + e.clientX - startPtr.current.x, startPos.current.y + e.clientY - startPtr.current.y);
      setPos(final);
      localStorage.setItem(PENNY_STORAGE_KEY, JSON.stringify(final));
    } else {
      onToggle();
    }
  }, [onToggle]);

  return (
    <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="fixed z-50 cursor-grab active:cursor-grabbing select-none group"
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
      aria-label="Toggle Penny"
    >
      <span className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
      <div className={cn(
        "relative w-14 h-14 rounded-full overflow-hidden ring-2 shadow-lg transition-transform group-hover:scale-110",
        showAgent ? "ring-primary shadow-primary/25" : "ring-muted-foreground/40 shadow-muted-foreground/15"
      )}>
        <img src={accountingHelper} alt="Penny" className="w-full h-full object-cover pointer-events-none" draggable={false} />
      </div>
      <span className={cn("absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-background rounded-full", showAgent ? "bg-emerald-500" : "bg-muted-foreground/50")} />
    </button>
  );
}

export default function AccountingWorkspace() {
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  const urlSearch = searchParams.get("search") || "";
  const [activeTab, setActiveTab] = useState(urlTab || "dashboard");
  const [showAgent, setShowAgent] = useState(true);
  const [agentMode, setAgentMode] = useState<"default" | "minimized" | "fullscreen">("default");
  const qb = useQuickBooksData();
  const { pendingCount } = usePennyQueue();
  const { startOAuth } = useIntegrations();
  const { isAdmin, hasRole, isLoading: rolesLoading } = useUserRole();
  const [webPhoneState, webPhoneActions] = useWebPhone();
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(() => {
    try { return localStorage.getItem(QB_LAST_LOAD_TIME_KEY); } catch { return null; }
  });

  const hasAccess = isAdmin || hasRole("accounting");

  // Stable refs for init-once logic
  const loadAllRef = useRef(qb.loadAll);
  loadAllRef.current = qb.loadAll;
  const webPhoneActionsRef = useRef(webPhoneActions);
  webPhoneActionsRef.current = webPhoneActions;
  const webPhoneStatusRef = useRef(webPhoneState.status);
  webPhoneStatusRef.current = webPhoneState.status;

  const updateRefreshTimestamp = useCallback(() => {
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    setLastRefreshTime(time);
    localStorage.setItem(QB_LAST_LOAD_TIME_KEY, time);
    localStorage.setItem(QB_LAST_LOAD_KEY, now.toLocaleDateString("en-CA"));
  }, []);

  const handleManualRefresh = useCallback(() => {
    qb.loadAll();
    updateRefreshTimestamp();
  }, [qb.loadAll, updateRefreshTimestamp]);

  useEffect(() => {
    if (!hasAccess) return;

    const today = new Date().toLocaleDateString("en-CA");
    const lastLoad = localStorage.getItem(QB_LAST_LOAD_KEY);

    if (lastLoad !== today) {
      loadAllRef.current();
      updateRefreshTimestamp();
    }

    if (webPhoneStatusRef.current === "idle") {
      webPhoneActionsRef.current.initialize();
    }
  }, [hasAccess, updateRefreshTimestamp]);

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

  // Error state with retry
  if (qb.error && !qb.loading && qb.connected !== false) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-lg w-full">
          <CardContent className="p-10 text-center space-y-6">
            <div className="p-6 rounded-2xl bg-destructive/10 w-fit mx-auto">
              <AlertTriangle className="w-16 h-16 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold">Failed to Load Data</h1>
            <p className="text-lg text-muted-foreground">
              QuickBooks data couldn't be loaded. Please try again.
            </p>
            <Button size="lg" className="h-14 text-lg px-8" onClick={() => qb.loadAll()}>
              <RefreshCw className="w-5 h-5 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Allow documents tab even without QuickBooks
  if (qb.connected === false && activeTab !== "documents") {
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
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="h-14 text-lg px-8"
                onClick={() => startOAuth("quickbooks")}
              >
                <Plug className="w-5 h-5 mr-2" />
                Connect QuickBooks
              </Button>
            </div>
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
            <AccountingNavMenus activeTab={activeTab} onNavigate={setActiveTab} pendingCount={pendingCount} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastRefreshTime && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Last updated: {lastRefreshTime}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleManualRefresh}
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
            {activeTab === "invoices" && <AccountingInvoices data={qb} initialSearch={urlSearch} />}
            {activeTab === "bills" && <AccountingBills data={qb} />}
            {activeTab === "payments" && <AccountingPayments data={qb} />}
            {activeTab === "customers" && <AccountingCustomers data={qb} />}
            {activeTab === "vendors" && <AccountingVendors data={qb} />}
            {activeTab === "accounts" && <AccountingAccounts data={qb} />}
            {activeTab === "audit" && <AccountingAudit data={qb} />}
            {activeTab === "payroll" && <AccountingPayroll data={qb} />}
            {activeTab === "payroll-audit" && <PayrollAuditView />}
            {activeTab === "orders" && <AccountingOrders />}
            {activeTab === "actions" && <AccountingActionQueue />}
            {activeTab === "vendor-payments" && <AccountingVendorPayments />}
            {activeTab === "budgets" && <BudgetManagement />}
            {activeTab === "quote-templates" && <QuoteTemplateManager />}
            {activeTab === "expense-claims" && <ExpenseClaimsManager />}
            {activeTab === "three-way-matching" && <ThreeWayMatchingManager />}
            {activeTab === "employee-contracts" && <EmployeeContractsManager />}
            {activeTab === "recruitment" && <RecruitmentPipeline />}
            {activeTab === "project-management" && <ProjectManagement />}
            {activeTab === "sales-receipts" && <AccountingSalesReceipts data={qb} />}
            {activeTab === "refund-receipts" && <AccountingRefundReceipts data={qb} />}
            {activeTab === "deposits" && <AccountingDeposits data={qb} />}
            {activeTab === "transfers" && <AccountingTransfers data={qb} />}
            {activeTab === "journal-entries" && <AccountingJournalEntries data={qb} />}
            {activeTab === "recurring" && <AccountingRecurring data={qb} />}
            {activeTab === "batch-actions" && <AccountingBatchActions data={qb} />}
            {activeTab === "statements" && <AccountingStatements data={qb} />}
            {activeTab === "expenses" && <AccountingExpenses data={qb} />}
            {activeTab === "attachments" && <AccountingAttachments data={qb} />}
            {activeTab === "reconciliation" && <AccountingReconciliation />}
            {activeTab === "scheduled-reports" && <AccountingScheduledReports />}
            {activeTab === "recurring-auto" && <AccountingRecurringTxns />}
            {activeTab === "tax-planning" && <TaxPlanning />}
            {activeTab === "budget-vs-actuals" && <BudgetVsActuals />}
            {activeTab === "documents" && <AccountingDocuments data={qb} />}
            {activeTab === "balance-sheet" && <AccountingReport data={qb} report="balance-sheet" />}
            {activeTab === "profit-loss" && <AccountingReport data={qb} report="profit-loss" />}
            {activeTab === "cash-flow" && <AccountingReport data={qb} report="cash-flow" />}
            {activeTab === "aged-receivables" && <AccountingAgedReceivables data={qb} />}
            {activeTab === "aged-payables" && <AccountingAgedPayables data={qb} />}
            {activeTab === "general-ledger" && <AccountingQBReport data={qb} report="general-ledger" />}
            {activeTab === "trial-balance" && <AccountingQBReport data={qb} report="trial-balance" />}
            {activeTab === "transaction-list" && <AccountingQBReport data={qb} report="transaction-list" />}
          </div>
        )}

        {/* Penny Agent Panel (side panel / fullscreen on desktop) */}
        {showAgent && (
          <div className={cn(
            "hidden lg:flex shrink-0 border-l border-border overflow-hidden",
            agentMode === "fullscreen" ? "flex-1" : "w-[400px]",
            "p-3"
          )}>
            <div className="w-full h-full min-h-0">
              <AccountingAgent
                viewMode={agentMode}
                onViewModeChange={(m) => setAgentMode(m)}
                qbSummary={qb}
                autoGreet
                webPhoneState={webPhoneState}
                webPhoneActions={webPhoneActions}
              />
            </div>
          </div>
        )}
      </div>

      {/* Penny Agent Panel (overlay on mobile) */}
      {showAgent && (
        <div className={cn(
          "lg:hidden fixed z-50",
          agentMode === "fullscreen"
            ? "inset-0 bg-background p-3"
            : "inset-x-3 bottom-3 max-h-[75vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        )}>
          {/* Mobile close button */}
          {agentMode !== "fullscreen" && (
            <button
              onClick={() => setShowAgent(false)}
              className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-muted/80 backdrop-blur flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Close Penny"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <AccountingAgent
            viewMode={agentMode}
            onViewModeChange={(m) => setAgentMode(m)}
            qbSummary={qb}
            autoGreet
            webPhoneState={webPhoneState}
            webPhoneActions={webPhoneActions}
          />
        </div>
      )}

      {/* Draggable Penny FAB */}
      <PennyFab showAgent={showAgent} onToggle={() => setShowAgent(s => !s)} />
    </div>
  );
}

AccountingWorkspace.displayName = "AccountingWorkspace";
