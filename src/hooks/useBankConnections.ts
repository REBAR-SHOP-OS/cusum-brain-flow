import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export interface BankConnection {
  id: string;
  company_id: string;
  institution_name: string;
  plaid_item_id: string;
  account_mask: string | null;
  account_name: string | null;
  account_type: string | null;
  plaid_account_id: string | null;
  linked_qb_account_id: string | null;
  status: string;
  last_balance_sync: string | null;
  last_balance: number | null;
  created_at: string;
}

export function useBankConnections() {
  const { companyId } = useCompanyId();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConnections = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bank_connections")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "active");
    if (!error && data) {
      setConnections(data as unknown as BankConnection[]);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const createLinkToken = useCallback(async () => {
    return invokeEdgeFunction<{ link_token: string }>("plaid-bank", {
      action: "create-link-token",
    });
  }, []);

  const exchangeToken = useCallback(
    async (publicToken: string, institutionName: string) => {
      if (!companyId) throw new Error("No company context");
      const result = await invokeEdgeFunction("plaid-bank", {
        action: "exchange-token",
        public_token: publicToken,
        company_id: companyId,
        institution_name: institutionName,
      });
      await fetchConnections();
      return result;
    },
    [companyId, fetchConnections]
  );

  const refreshBalances = useCallback(async () => {
    if (!companyId) return;
    const result = await invokeEdgeFunction("plaid-bank", {
      action: "get-balances",
      company_id: companyId,
    });
    await fetchConnections();
    return result;
  }, [companyId, fetchConnections]);

  const linkToQB = useCallback(
    async (connectionId: string, qbAccountId: string) => {
      const result = await invokeEdgeFunction("plaid-bank", {
        action: "link-to-qb",
        connection_id: connectionId,
        qb_account_id: qbAccountId,
      });
      await fetchConnections();
      return result;
    },
    [fetchConnections]
  );

  const hasConnections = connections.length > 0;

  return {
    connections,
    loading,
    hasConnections,
    fetchConnections,
    createLinkToken,
    exchangeToken,
    refreshBalances,
    linkToQB,
  };
}
