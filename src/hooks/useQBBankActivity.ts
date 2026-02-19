import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface QBBankActivity {
  id: string;
  company_id: string;
  qb_account_id: string;
  account_name: string;
  ledger_balance: number;
  bank_balance: number | null;
  unreconciled_count: number;
  reconciled_through_date: string | null;
  last_qb_sync_at: string | null;
  updated_by: string | null;
}

export function useQBBankActivity() {
  const { companyId } = useCompanyId();
  const [activities, setActivities] = useState<QBBankActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("qb_bank_activity")
      .select("*")
      .eq("company_id", companyId);
    if (!error && data) {
      setActivities(data as unknown as QBBankActivity[]);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const getActivity = useCallback(
    (qbAccountId: string): QBBankActivity | undefined => {
      return activities.find((a) => a.qb_account_id === qbAccountId);
    },
    [activities]
  );

  const upsertBankBalance = useCallback(
    async (qbAccountId: string, accountName: string, bankBalance: number) => {
      if (!companyId) return;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("qb_bank_activity")
        .upsert(
          {
            company_id: companyId,
            qb_account_id: qbAccountId,
            account_name: accountName,
            bank_balance: bankBalance,
            updated_by: user?.id ?? null,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "company_id,qb_account_id" }
        );
      if (!error) {
        await fetchActivities();
      }
      return error;
    },
    [companyId, fetchActivities]
  );

  const triggerSync = useCallback(async () => {
    if (!companyId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("qb-sync-engine", {
        body: { action: "sync-bank-activity", company_id: companyId },
      });
      if (error) {
        console.error("Bank activity sync error:", error);
      }
      await fetchActivities();
      return data;
    } finally {
      setSyncing(false);
    }
  }, [companyId, fetchActivities]);

  return { activities, loading, syncing, fetchActivities, getActivity, upsertBankBalance, triggerSync };
}
