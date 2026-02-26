import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface ActualEntry {
  name: string;
  category: string;
  months: number[]; // 12 months, Jan=0 … Dec=11
}

/**
 * Pulls actual spending/revenue data from accounting_mirror for a given fiscal year.
 * Groups by entity_type and month to create monthly totals that can be compared
 * against budget line items.
 */
export function useActuals(fiscalYear: number) {
  const { companyId } = useCompanyId();

  const { data: actuals = [], isLoading } = useQuery({
    queryKey: ["actuals", companyId, fiscalYear],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];

      const startDate = `${fiscalYear}-01-01`;
      const endDate = `${fiscalYear}-12-31`;

      // Pull all transactions for the fiscal year from accounting_mirror
      const { data: rows, error } = await supabase
        .from("accounting_mirror")
        .select("entity_type, balance, data")
        .eq("company_id", companyId)
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`);

      if (error) throw error;
      if (!rows || rows.length === 0) return [];

      // Group by entity_type → monthly totals
      const groups: Record<string, number[]> = {};

      for (const row of rows) {
        const d = row.data as Record<string, unknown> | null;
        const txnDate = (d?.TxnDate as string) || "";
        const totalAmt = (d?.TotalAmt as number) || row.balance || 0;

        if (!txnDate) continue;

        const date = new Date(txnDate);
        if (date.getFullYear() !== fiscalYear) continue;

        const monthIdx = date.getMonth();
        const entityType = row.entity_type || "Other";

        // Map entity types to meaningful budget categories
        const category = mapEntityToCategory(entityType);
        const key = `${category}`;

        if (!groups[key]) groups[key] = new Array(12).fill(0);
        groups[key][monthIdx] += Math.abs(totalAmt);
      }

      // Convert to ActualEntry[]
      const entries: ActualEntry[] = Object.entries(groups).map(([name, months]) => ({
        name,
        category: name.toLowerCase(),
        months,
      }));

      return entries;
    },
    staleTime: 1000 * 60 * 5,
  });

  return { actuals, isLoading };
}

function mapEntityToCategory(entityType: string): string {
  switch (entityType) {
    case "Invoice":
    case "SalesReceipt":
      return "Revenue";
    case "Bill":
    case "BillPayment":
      return "Cost of Goods";
    case "Payment":
      return "Payments Received";
    case "Deposit":
    case "Transfer":
      return "Banking";
    case "JournalEntry":
      return "Adjustments";
    case "Expense":
    case "Purchase":
      return "Operating Expenses";
    default:
      return "Other";
  }
}
