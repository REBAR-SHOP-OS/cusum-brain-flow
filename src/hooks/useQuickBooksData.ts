import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { reportToVizzy } from "@/lib/vizzyAutoReport";

// ─── QB Interfaces ─────────────────────────────────────────────────

export interface QBInvoice {
  Id: string;
  DocNumber: string;
  CustomerRef: { value: string; name: string };
  TotalAmt: number;
  Balance: number;
  DueDate: string;
  TxnDate: string;
  EmailStatus: string;
  SyncToken?: string;
}

export interface QBBill {
  Id: string;
  DocNumber: string;
  VendorRef: { value: string; name: string };
  TotalAmt: number;
  Balance: number;
  DueDate: string;
  TxnDate: string;
}

export interface QBPayment {
  Id: string;
  TotalAmt: number;
  TxnDate: string;
  CustomerRef: { value: string; name: string };
}

export interface QBVendor {
  Id: string;
  DisplayName: string;
  CompanyName: string;
  Balance: number;
  Active: boolean;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
}

export interface QBCustomer {
  Id: string;
  DisplayName: string;
  CompanyName: string;
  Balance: number;
  Active: boolean;
}

export interface QBAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType: string;
  CurrentBalance: number;
  Active: boolean;
}

export interface QBEstimate {
  Id: string;
  DocNumber: string;
  CustomerRef: { value: string; name: string };
  TotalAmt: number;
  TxnDate: string;
  ExpirationDate: string;
  TxnStatus: string;
}

export interface QBItem {
  Id: string;
  Name: string;
  Type: string;
  UnitPrice: number;
  Active: boolean;
  Description?: string;
}

export interface QBPurchaseOrder {
  Id: string;
  DocNumber: string;
  VendorRef: { value: string; name: string };
  TotalAmt: number;
  TxnDate: string;
  DueDate: string;
  POStatus: string;
}

export interface QBCreditMemo {
  Id: string;
  DocNumber: string;
  CustomerRef: { value: string; name: string };
  TotalAmt: number;
  Balance: number;
  TxnDate: string;
}

export interface QBEmployee {
  Id: string;
  DisplayName: string;
  GivenName: string;
  FamilyName: string;
  PrimaryPhone?: { FreeFormNumber: string };
  PrimaryEmailAddr?: { Address: string };
  Active: boolean;
  HiredDate?: string;
  ReleasedDate?: string;
  SSN?: string;
  SyncToken: string;
}

export interface QBTimeActivity {
  Id: string;
  NameOf: string;
  EmployeeRef?: { value: string; name: string };
  Hours: number;
  Minutes: number;
  TxnDate: string;
  Description?: string;
}

// ─── Retry helper ──────────────────────────────────────────────────

async function retryQBAction(
  qbActionFn: (action: string, body?: Record<string, unknown>) => Promise<unknown>,
  action: string,
  body?: Record<string, unknown>,
  maxRetries = 2,
): Promise<unknown> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await qbActionFn(action, body);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = attempt === 0 ? 1000 : 3000;
      console.warn(`[QB] retryQBAction: ${action} failed (attempt ${attempt + 1}), retrying in ${delay}ms`, err);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

// ─── ERP Mirror helpers ────────────────────────────────────────────

async function loadMirrorEntity(table: string, selectCols: string, filterCol: string, filterVal: boolean | string): Promise<unknown[]> {
  const all: unknown[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data } = await supabase
      .from(table as any)
      .select(selectCols)
      .eq(filterCol, filterVal as any)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const rows = (data as unknown[]) || [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    page++;
  }
  return all;
}

async function loadMirrorTransactions(entityType: string): Promise<unknown[]> {
  const all: unknown[] = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data } = await supabase
      .from("qb_transactions")
      .select("qb_id, entity_type, doc_number, total_amt, balance, txn_date, customer_qb_id, vendor_qb_id, raw_json, is_voided, is_deleted")
      .eq("entity_type", entityType)
      .eq("is_deleted", false)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const rows = data || [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    page++;
  }
  return all;
}

function mirrorTxnToQBFormat(row: Record<string, unknown>): Record<string, unknown> {
  const raw = row.raw_json as Record<string, unknown> | null;
  if (raw && Object.keys(raw).length > 2) return raw;
  return {
    Id: row.qb_id,
    DocNumber: row.doc_number,
    TotalAmt: row.total_amt,
    Balance: row.balance,
    TxnDate: row.txn_date,
    CustomerRef: row.customer_qb_id ? { value: row.customer_qb_id } : undefined,
    VendorRef: row.vendor_qb_id ? { value: row.vendor_qb_id } : undefined,
  };
}

// ─── Main Hook ─────────────────────────────────────────────────────

export interface TrialBalanceStatus {
  isBalanced: boolean;
  totalDiff: number;
  qbTotal: number;
  erpTotal: number;
  arDiff: number;
  apDiff: number;
  accountDetails: Array<{ account: string; qb: number; erp: number; diff: number }>;
  checkedAt: string;
}

export function useQuickBooksData() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<QBInvoice[]>([]);
  const [bills, setBills] = useState<QBBill[]>([]);
  const [payments, setPayments] = useState<QBPayment[]>([]);
  const [vendors, setVendors] = useState<QBVendor[]>([]);
  const [customers, setCustomers] = useState<QBCustomer[]>([]);
  const [accounts, setAccounts] = useState<QBAccount[]>([]);
  const [estimates, setEstimates] = useState<QBEstimate[]>([]);
  const [items, setItems] = useState<QBItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<QBPurchaseOrder[]>([]);
  const [creditMemos, setCreditMemos] = useState<QBCreditMemo[]>([]);
  const [employees, setEmployees] = useState<QBEmployee[]>([]);
  const [timeActivities, setTimeActivities] = useState<QBTimeActivity[]>([]);
  const [companyInfo, setCompanyInfo] = useState<Record<string, unknown> | null>(null);
  const [trialBalanceStatus, setTrialBalanceStatus] = useState<TrialBalanceStatus | null>(null);
  const [postingBlocked, setPostingBlocked] = useState(false);
  const { toast } = useToast();
  const warmUpFired = useRef(false);

  const qbAction = useCallback(async (action: string, body?: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("quickbooks-oauth", {
      body: { action, ...body },
    });
    if (error) throw new Error(error.message);
    return data;
  }, []);

  // Eager token warm-up + load last trial balance check
  useEffect(() => {
    if (warmUpFired.current) return;
    warmUpFired.current = true;
    qbAction("check-status")
      .then((data) => {
        if (data?.status === "connected") setConnected(true);
      })
      .catch(() => { /* silent warm-up */ });

    // Load last trial balance check to enforce hard-stop across page reloads
    supabase
      .from("trial_balance_checks")
      .select("*")
      .order("checked_at", { ascending: false })
      .limit(1)
      .then(({ data: checks }) => {
        if (checks && checks.length > 0) {
          const c = checks[0] as Record<string, unknown>;
          const status: TrialBalanceStatus = {
            isBalanced: c.is_balanced as boolean,
            totalDiff: c.total_diff as number,
            qbTotal: c.qb_total as number,
            erpTotal: c.erp_total as number,
            arDiff: (c.ar_diff as number) || 0,
            apDiff: (c.ap_diff as number) || 0,
            accountDetails: (c.details as TrialBalanceStatus["accountDetails"]) || [],
            checkedAt: c.checked_at as string,
          };
          setTrialBalanceStatus(status);
          setPostingBlocked(!status.isBalanced);
        }
      });
  }, [qbAction]);

  const checkConnection = useCallback(async () => {
    try {
      const data = await qbAction("check-status");
      setConnected(data.status === "connected");
      return data.status === "connected";
    } catch {
      setConnected(false);
      return false;
    }
  }, [qbAction]);

  // ─── ERP-native load: read from mirror tables first, fallback to QB API ───

  const loadFromMirror = useCallback(async (): Promise<boolean> => {
    try {
      const { count } = await supabase
        .from("qb_transactions")
        .select("id", { count: "exact", head: true })
        .eq("is_deleted", false)
        .limit(1);

      if (!count || count === 0) return false;

      const [
        mirrorInvoices, mirrorBills, mirrorPayments,
        mirrorEstimates, mirrorPOs, mirrorCMs,
        mirrorAccountsData, mirrorCustomersData, mirrorVendorsData, mirrorItemsData,
      ] = await Promise.all([
        loadMirrorTransactions("Invoice"),
        loadMirrorTransactions("Bill"),
        loadMirrorTransactions("Payment"),
        loadMirrorTransactions("Estimate"),
        loadMirrorTransactions("PurchaseOrder"),
        loadMirrorTransactions("CreditMemo"),
        loadMirrorEntity("qb_accounts", "*", "is_deleted", false),
        loadMirrorEntity("qb_customers", "*", "is_deleted", false),
        loadMirrorEntity("qb_vendors", "*", "is_deleted", false),
        loadMirrorEntity("qb_items", "*", "is_deleted", false),
      ]);

      setInvoices((mirrorInvoices as Record<string, unknown>[]).map(r => mirrorTxnToQBFormat(r) as unknown as QBInvoice));
      setBills((mirrorBills as Record<string, unknown>[]).map(r => mirrorTxnToQBFormat(r) as unknown as QBBill));
      setPayments((mirrorPayments as Record<string, unknown>[]).map(r => mirrorTxnToQBFormat(r) as unknown as QBPayment));
      setEstimates((mirrorEstimates as Record<string, unknown>[]).map(r => mirrorTxnToQBFormat(r) as unknown as QBEstimate));
      setPurchaseOrders((mirrorPOs as Record<string, unknown>[]).map(r => mirrorTxnToQBFormat(r) as unknown as QBPurchaseOrder));
      setCreditMemos((mirrorCMs as Record<string, unknown>[]).map(r => mirrorTxnToQBFormat(r) as unknown as QBCreditMemo));

      if (mirrorAccountsData.length) {
        setAccounts((mirrorAccountsData as Record<string, unknown>[]).map((a) => {
          const raw = a.raw_json as Record<string, unknown> | null;
          return (raw && Object.keys(raw).length > 2 ? raw : {
            Id: a.qb_id, Name: a.name, AccountType: a.account_type,
            AccountSubType: a.account_sub_type, CurrentBalance: a.current_balance, Active: a.is_active,
          }) as unknown as QBAccount;
        }));
      }

      if (mirrorCustomersData.length) {
        setCustomers((mirrorCustomersData as Record<string, unknown>[]).map((c) => ({
          Id: c.qb_id as string, DisplayName: c.display_name as string,
          CompanyName: (c.company_name as string) || "", Balance: (c.balance as number) || 0,
          Active: c.is_active as boolean,
        })));
      }

      if (mirrorVendorsData.length) {
        setVendors((mirrorVendorsData as Record<string, unknown>[]).map((v) => {
          const raw = v.raw_json as Record<string, unknown> | null;
          return (raw && Object.keys(raw).length > 2 ? raw : {
            Id: v.qb_id, DisplayName: v.display_name, CompanyName: v.company_name,
            Balance: v.balance, Active: v.is_active,
          }) as unknown as QBVendor;
        }));
      }

      if (mirrorItemsData.length) {
        setItems((mirrorItemsData as Record<string, unknown>[]).map((it) => {
          const raw = it.raw_json as Record<string, unknown> | null;
          return (raw && Object.keys(raw).length > 2 ? raw : {
            Id: it.qb_id, Name: it.name, Type: it.type,
            UnitPrice: it.unit_price, Active: it.is_active, Description: it.description,
          }) as unknown as QBItem;
        }));
      }

      console.log("[QB] Loaded from ERP mirror tables");
      return true;
    } catch (err) {
      console.warn("[QB] Mirror load failed, falling back to API:", err);
      return false;
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Run connection check and mirror load in parallel
      const [isConnected, mirrorLoaded] = await Promise.all([
        checkConnection(),
        loadFromMirror(),
      ]);

      if (!isConnected) {
        setLoading(false);
        return;
      }

      if (mirrorLoaded) {
        setLoading(false);
        // Background: trigger incremental sync to refresh mirror data, then reload
        (async () => {
          try {
            await qbAction("incremental-sync");
            // Re-load from mirror after sync completes to update UI with fresh data
            await loadFromMirror();
            console.log("[QB] Background incremental sync completed, mirror refreshed");
          } catch (e) {
            console.warn("[QB] Background incremental sync failed:", e);
          }
        })();
        // Background: load employees & time activities from QB API (not mirrored yet)
        // Stagger calls to avoid rate limiting, with retry wrapper
        (async () => {
          try {
            const empData = await retryQBAction(qbAction, "list-employees");
            setEmployees((empData as Record<string, unknown>).employees as QBEmployee[] || []);
          } catch {}
          await new Promise(r => setTimeout(r, 500));
          try {
            const taData = await retryQBAction(qbAction, "list-time-activities");
            setTimeActivities((taData as Record<string, unknown>).timeActivities as QBTimeActivity[] || []);
          } catch {}
          await new Promise(r => setTimeout(r, 500));
          try {
            const ciData = await retryQBAction(qbAction, "get-company-info");
            setCompanyInfo(ciData as Record<string, unknown>);
          } catch {}
        })();
        return;
      }

      // Fallback: load from QB API (original behavior)
      const dashboardData = await qbAction("dashboard-summary");
      setInvoices(dashboardData.invoices || []);
      setBills(dashboardData.bills || []);
      setPayments(dashboardData.payments || []);

      try {
        const fullAccounts = await qbAction("list-accounts");
        setAccounts(fullAccounts.accounts || []);
      } catch {
        setAccounts(dashboardData.accounts || []);
      }

      setLoading(false);

      // Batch 1: vendors, estimates, company-info, items
      const [vendorsResult, estimatesResult, companyInfoResult, itemsResult] = await Promise.allSettled([
        retryQBAction(qbAction, "list-vendors"),
        retryQBAction(qbAction, "list-estimates"),
        retryQBAction(qbAction, "get-company-info"),
        retryQBAction(qbAction, "list-items"),
      ]);

      if (vendorsResult.status === "fulfilled") setVendors((vendorsResult.value as Record<string, unknown>).vendors as QBVendor[] || []);
      if (estimatesResult.status === "fulfilled") setEstimates((estimatesResult.value as Record<string, unknown>).estimates as QBEstimate[] || []);
      if (companyInfoResult.status === "fulfilled") setCompanyInfo(companyInfoResult.value as Record<string, unknown>);
      if (itemsResult.status === "fulfilled") setItems((itemsResult.value as Record<string, unknown>).items as QBItem[] || []);

      // Batch 2: POs, credit-memos, employees, time-activities
      const [poResult, cmResult, empResult, taResult] = await Promise.allSettled([
        retryQBAction(qbAction, "list-purchase-orders"),
        retryQBAction(qbAction, "list-credit-memos"),
        retryQBAction(qbAction, "list-employees"),
        retryQBAction(qbAction, "list-time-activities"),
      ]);

      if (poResult.status === "fulfilled") setPurchaseOrders((poResult.value as Record<string, unknown>).purchaseOrders as QBPurchaseOrder[] || []);
      if (cmResult.status === "fulfilled") setCreditMemos((cmResult.value as Record<string, unknown>).creditMemos as QBCreditMemo[] || []);
      if (empResult.status === "fulfilled") setEmployees((empResult.value as Record<string, unknown>).employees as QBEmployee[] || []);
      if (taResult.status === "fulfilled") setTimeActivities((taResult.value as Record<string, unknown>).timeActivities as QBTimeActivity[] || []);

      // Batch 3: sync-customers, sync-invoices
      const [syncCustResult] = await Promise.allSettled([
        retryQBAction(qbAction, "sync-customers"),
        retryQBAction(qbAction, "sync-invoices"),
      ]);

      // Load synced customers from DB
      const allDbCustomers: typeof dbCustomersPage = [];
      let dbPage = 0;
      const DB_PAGE_SIZE = 1000;
      let dbCustomersPage: { quickbooks_id: string | null; name: string; company_name: string | null; credit_limit: number | null; status: string | null }[] = [];
      while (true) {
        const { data: page } = await supabase
          .from("customers")
          .select("quickbooks_id, name, company_name, credit_limit, status")
          .not("quickbooks_id", "is", null)
          .range(dbPage * DB_PAGE_SIZE, (dbPage + 1) * DB_PAGE_SIZE - 1);
        const rows = page || [];
        allDbCustomers.push(...rows);
        if (rows.length < DB_PAGE_SIZE) break;
        dbPage++;
      }

      if (allDbCustomers.length > 0) {
        setCustomers(allDbCustomers.map(c => ({
          Id: c.quickbooks_id!,
          DisplayName: c.name,
          CompanyName: c.company_name || "",
          Balance: 0,
          Active: c.status === "active",
        })));
      }
    } catch (err) {
      console.error("QB load error:", err);
      const errMsg = String(err);
      setError(errMsg);
      toast({ title: "Error loading data", description: errMsg, variant: "destructive" });
      reportToVizzy(`QuickBooks data load failed: ${errMsg}`, "Accounting — useQuickBooksData.loadAll");
    } finally {
      setLoading(false);
    }
  }, [checkConnection, loadFromMirror, qbAction, toast]);

  const syncEntity = useCallback(async (entity: string) => {
    setSyncing(entity);
    try {
      const data = await qbAction(`sync-${entity}`);
      toast({ title: `✅ Synced ${entity}`, description: `${data.synced || 0} records updated` });
      await loadAll();
    } catch (err) {
      toast({ title: `Sync failed`, description: String(err), variant: "destructive" });
    } finally {
      setSyncing(null);
    }
  }, [qbAction, toast, loadAll]);

  const createEntity = useCallback(async (action: string, body: Record<string, unknown>) => {
    // ⛔ HARD STOP: Block posting if trial balance is mismatched
    if (postingBlocked && trialBalanceStatus && !trialBalanceStatus.isBalanced) {
      const details = trialBalanceStatus.accountDetails
        .map(d => `• ${d.account}: QB $${d.qb.toFixed(2)} vs ERP $${d.erp.toFixed(2)} (Δ $${d.diff.toFixed(2)})`)
        .join("\n");
      const msg = `⛔ POSTING BLOCKED — Trial balance mismatch of $${trialBalanceStatus.totalDiff.toFixed(2)}.\n\n${details || "Run reconciliation for details."}`;
      toast({ title: "⛔ Posting Blocked", description: msg, variant: "destructive" });
      reportToVizzy(`Posting blocked: trial balance mismatch $${trialBalanceStatus.totalDiff.toFixed(2)}`, "Accounting — createEntity hard-stop");
      throw new Error(msg);
    }
    const data = await qbAction(action, body);
    toast({ title: "✅ Created successfully", description: `Doc #${data.docNumber || "N/A"}` });
    await loadAll();
    return data;
  }, [qbAction, toast, loadAll, postingBlocked, trialBalanceStatus]);

  const updateInvoice = useCallback(async (invoiceId: string, updates: Record<string, unknown>) => {
    if (postingBlocked && trialBalanceStatus && !trialBalanceStatus.isBalanced) {
      const msg = `⛔ POSTING BLOCKED — Trial balance mismatch of $${trialBalanceStatus.totalDiff.toFixed(2)}.`;
      toast({ title: "⛔ Posting Blocked", description: msg, variant: "destructive" });
      throw new Error(msg);
    }
    const data = await qbAction("update-invoice", { invoiceId, updates });
    toast({ title: "✅ Invoice updated", description: `Invoice #${data.docNumber || invoiceId} saved` });
    await loadAll();
    return data;
  }, [qbAction, toast, loadAll, postingBlocked, trialBalanceStatus]);

  const sendInvoice = useCallback(async (invoiceId: string, email?: string) => {
    await qbAction("send-invoice", { invoiceId, email });
    toast({ title: "📧 Invoice sent", description: `Invoice emailed${email ? ` to ${email}` : ""}` });
  }, [qbAction, toast]);

  const voidInvoice = useCallback(async (invoiceId: string, syncToken: string) => {
    await qbAction("void-invoice", { invoiceId, syncToken });
    toast({ title: "🚫 Invoice voided" });
    await loadAll();
  }, [qbAction, toast, loadAll]);

  const createPayrollCorrection = useCallback(async (body: Record<string, unknown>) => {
    try {
      const data = await qbAction("create-payroll-correction", body);
      toast({ title: "✅ Payroll correction created", description: `Journal Entry #${data.docNumber || "N/A"}` });
      await loadAll();
      return data;
    } catch (err) {
      reportToVizzy(`Payroll correction failed: ${String(err)}`, "Accounting — createPayrollCorrection");
      throw err;
    }
  }, [qbAction, toast, loadAll]);

  // Trigger full sync engine
  const triggerFullSync = useCallback(async () => {
    setSyncing("full-sync");
    try {
      const data = await qbAction("full-sync");
      toast({ title: "✅ Full sync complete", description: `Synced all QB data to ERP mirror` });
      await loadAll();
      return data;
    } catch (err) {
      toast({ title: "Full sync failed", description: String(err), variant: "destructive" });
    } finally {
      setSyncing(null);
    }
  }, [qbAction, toast, loadAll]);

  const triggerIncrementalSync = useCallback(async () => {
    setSyncing("incremental");
    try {
      const data = await qbAction("incremental-sync");
      toast({ title: "✅ Incremental sync complete", description: `${data.synced || 0} records updated` });
      await loadAll();
      return data;
    } catch (err) {
      toast({ title: "Incremental sync failed", description: String(err), variant: "destructive" });
    } finally {
      setSyncing(null);
    }
  }, [qbAction, toast, loadAll]);

  const triggerReconcile = useCallback(async () => {
    setSyncing("reconcile");
    try {
      const data = await qbAction("reconcile");
      const diff = data.trial_balance_diff;
      const isBalanced = data.is_balanced ?? (diff <= 0.01);

      // Persist trial balance status for hard-stop enforcement
      const status: TrialBalanceStatus = {
        isBalanced,
        totalDiff: diff,
        qbTotal: data.qb || 0,
        erpTotal: data.erp || 0,
        arDiff: data.ar_diff || 0,
        apDiff: data.ap_diff || 0,
        accountDetails: data.account_details || [],
        checkedAt: new Date().toISOString(),
      };
      setTrialBalanceStatus(status);
      setPostingBlocked(!isBalanced);

      toast({
        title: !isBalanced ? "⛔ Trial Balance Mismatch — Posting Blocked" : "✅ Reconciliation complete",
        description: !isBalanced
          ? `Difference: $${diff.toFixed(2)}. All accounting posts are BLOCKED until resolved.`
          : "QB and ERP match. Posting enabled.",
        variant: !isBalanced ? "destructive" : "default",
      });
      return data;
    } catch (err) {
      toast({ title: "Reconciliation failed", description: String(err), variant: "destructive" });
    } finally {
      setSyncing(null);
    }
  }, [qbAction, toast]);

  // Computed summaries
  const totalReceivable = invoices.reduce((sum, inv) => sum + (inv.Balance || 0), 0);
  const totalPayable = bills.reduce((sum, b) => sum + (b.Balance || 0), 0);
  const overdueInvoices = invoices.filter(inv => inv.Balance > 0 && new Date(inv.DueDate) < new Date());
  const overdueBills = bills.filter(b => b.Balance > 0 && new Date(b.DueDate) < new Date());

  return {
    loading, syncing, connected, error, postingBlocked, trialBalanceStatus,
    invoices, bills, payments, vendors, customers, accounts, estimates, items, purchaseOrders, creditMemos, employees, timeActivities, companyInfo,
    totalReceivable, totalPayable, overdueInvoices, overdueBills,
    checkConnection, loadAll, syncEntity, createEntity, sendInvoice, voidInvoice, updateInvoice, createPayrollCorrection, qbAction,
    triggerFullSync, triggerIncrementalSync, triggerReconcile,
  };
}
