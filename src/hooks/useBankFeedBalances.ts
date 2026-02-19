import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface BankFeedBalance {
  id: string;
  account_id: string;
  account_name: string;
  bank_balance: number;
  last_updated: string;
  updated_by: string | null;
  company_id: string;
  unaccepted_count: number | null;
  unreconciled_count: number | null;
  reconciled_through: string | null;
}

export function useBankFeedBalances() {
  const { companyId } = useCompanyId();
  const [balances, setBalances] = useState<BankFeedBalance[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bank_feed_balances")
      .select("*")
      .eq("company_id", companyId);
    if (!error && data) {
      setBalances(data as unknown as BankFeedBalance[]);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  const upsertBalance = useCallback(
    async (accountId: string, accountName: string, bankBalance: number) => {
      if (!companyId) return;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("bank_feed_balances")
        .upsert(
          {
            account_id: accountId,
            account_name: accountName,
            bank_balance: bankBalance,
            company_id: companyId,
            updated_by: user?.id ?? null,
            last_updated: new Date().toISOString(),
          } as any,
          { onConflict: "account_id,company_id" }
        );
      if (!error) {
        await fetchBalances();
      }
      return error;
    },
    [companyId, fetchBalances]
  );

  const getBalance = useCallback(
    (accountId: string): BankFeedBalance | undefined => {
      return balances.find((b) => b.account_id === accountId);
    },
    [balances]
  );

  return { balances, loading, fetchBalances, upsertBalance, getBalance };
}
