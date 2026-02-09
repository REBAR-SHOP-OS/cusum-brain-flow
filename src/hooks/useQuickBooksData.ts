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

      // Batch QB API calls in small groups to avoid rate limiting (429)
      const batch1 = await Promise.allSettled([
        qbAction("list-invoices"),
        qbAction("list-bills"),
        qbAction("list-payments"),
      ]);
      if (batch1[0].status === "fulfilled") setInvoices(batch1[0].value.invoices || []);
      if (batch1[1].status === "fulfilled") setBills(batch1[1].value.bills || []);
      if (batch1[2].status === "fulfilled") setPayments(batch1[2].value.payments || []);

      const batch2 = await Promise.allSettled([
        qbAction("list-vendors"),
        qbAction("sync-customers"),
        qbAction("list-accounts"),
      ]);
      if (batch2[0].status === "fulfilled") setVendors(batch2[0].value.vendors || []);
      if (batch2[1].status === "fulfilled") {} // customers loaded from DB below
      if (batch2[2].status === "fulfilled") setAccounts(batch2[2].value.accounts || []);

      const batch3 = await Promise.allSettled([
        qbAction("list-estimates"),
        qbAction("get-company-info"),
        qbAction("list-items"),
      ]);
      if (batch3[0].status === "fulfilled") setEstimates(batch3[0].value.estimates || []);
      if (batch3[1].status === "fulfilled") setCompanyInfo(batch3[1].value);
      if (batch3[2].status === "fulfilled") setItems(batch3[2].value.items || []);

      const batch4 = await Promise.allSettled([
        qbAction("list-purchase-orders"),
        qbAction("list-credit-memos"),
        qbAction("list-employees"),
        qbAction("list-time-activities"),
      ]);
      if (batch4[0].status === "fulfilled") setPurchaseOrders(batch4[0].value.purchaseOrders || []);
      if (batch4[1].status === "fulfilled") setCreditMemos(batch4[1].value.creditMemos || []);
      if (batch4[2].status === "fulfilled") setEmployees(batch4[2].value.employees || []);
      if (batch4[3].status === "fulfilled") setTimeActivities(batch4[3].value.timeActivities || []);

      // Load synced customers from our DB
      const { data: dbCustomers } = await supabase
        .from("customers")
        .select("quickbooks_id, name, company_name, credit_limit, status")
        .not("quickbooks_id", "is", null);
      
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
