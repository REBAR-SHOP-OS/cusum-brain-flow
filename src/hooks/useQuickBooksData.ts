import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface QBInvoice {
  Id: string;
  DocNumber: string;
  CustomerRef: { value: string; name: string };
  TotalAmt: number;
  Balance: number;
  DueDate: string;
  TxnDate: string;
  EmailStatus: string;
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

export function useQuickBooksData() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
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
  const { toast } = useToast();

  const qbAction = useCallback(async (action: string, body?: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("quickbooks-oauth", {
      body: { action, ...body },
    });
    if (error) throw new Error(error.message);
    return data;
  }, []);

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

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const isConnected = await checkConnection();
      if (!isConnected) {
        setLoading(false);
        return;
      }

      // Phase 1: Single call for dashboard-critical data (invoices, bills, payments, bank accounts)
      const dashboardData = await qbAction("dashboard-summary");
      setInvoices(dashboardData.invoices || []);
      setBills(dashboardData.bills || []);
      setPayments(dashboardData.payments || []);
      setAccounts(dashboardData.accounts || []);
      setLoading(false); // Dashboard cards render immediately

      // Phase 2: Load secondary data in background (no loading spinner)
      const [
        vendorsResult, estimatesResult, companyInfoResult, itemsResult,
        poResult, cmResult, empResult, taResult,
        syncCustResult, syncInvResult, fullAccountsResult,
      ] = await Promise.allSettled([
        qbAction("list-vendors"),
        qbAction("list-estimates"),
        qbAction("get-company-info"),
        qbAction("list-items"),
        qbAction("list-purchase-orders"),
        qbAction("list-credit-memos"),
        qbAction("list-employees"),
        qbAction("list-time-activities"),
        qbAction("sync-customers"),
        qbAction("sync-invoices"),
        qbAction("list-accounts"),
      ]);

      if (vendorsResult.status === "fulfilled") setVendors(vendorsResult.value.vendors || []);
      if (estimatesResult.status === "fulfilled") setEstimates(estimatesResult.value.estimates || []);
      if (companyInfoResult.status === "fulfilled") setCompanyInfo(companyInfoResult.value);
      if (itemsResult.status === "fulfilled") setItems(itemsResult.value.items || []);
      if (poResult.status === "fulfilled") setPurchaseOrders(poResult.value.purchaseOrders || []);
      if (cmResult.status === "fulfilled") setCreditMemos(cmResult.value.creditMemos || []);
      if (empResult.status === "fulfilled") setEmployees(empResult.value.employees || []);
      if (taResult.status === "fulfilled") setTimeActivities(taResult.value.timeActivities || []);
      if (fullAccountsResult.status === "fulfilled") setAccounts(fullAccountsResult.value.accounts || []);

      // Load synced customers from our DB (paginate past Supabase 1000-row default)
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
      const dbCustomers = allDbCustomers;
      
      if (dbCustomers) {
        setCustomers(dbCustomers.map(c => ({
          Id: c.quickbooks_id!,
          DisplayName: c.name,
          CompanyName: c.company_name || "",
          Balance: 0,
          Active: c.status === "active",
        })));
      }
    } catch (err) {
      console.error("QB load error:", err);
      toast({ title: "Error loading data", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [checkConnection, qbAction, toast]);

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
    const data = await qbAction(action, body);
    toast({ title: "✅ Created successfully", description: `Doc #${data.docNumber || "N/A"}` });
    await loadAll();
    return data;
  }, [qbAction, toast, loadAll]);

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
    const data = await qbAction("create-payroll-correction", body);
    toast({ title: "✅ Payroll correction created", description: `Journal Entry #${data.docNumber || "N/A"}` });
    await loadAll();
    return data;
  }, [qbAction, toast, loadAll]);

  // Computed summaries
  const totalReceivable = invoices.reduce((sum, inv) => sum + (inv.Balance || 0), 0);
  const totalPayable = bills.reduce((sum, b) => sum + (b.Balance || 0), 0);
  const overdueInvoices = invoices.filter(inv => inv.Balance > 0 && new Date(inv.DueDate) < new Date());
  const overdueBills = bills.filter(b => b.Balance > 0 && new Date(b.DueDate) < new Date());

  return {
    loading, syncing, connected,
    invoices, bills, payments, vendors, customers, accounts, estimates, items, purchaseOrders, creditMemos, employees, timeActivities, companyInfo,
    totalReceivable, totalPayable, overdueInvoices, overdueBills,
    checkConnection, loadAll, syncEntity, createEntity, sendInvoice, voidInvoice, createPayrollCorrection, qbAction,
  };
}
