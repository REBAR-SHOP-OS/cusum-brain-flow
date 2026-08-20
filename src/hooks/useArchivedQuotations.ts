import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseArchivedQuotationsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export function useArchivedQuotations({
  page = 1,
  pageSize = 50,
  search = "",
  status = "all",
}: UseArchivedQuotationsParams = {}) {
  const { data, isLoading } = useQuery({
    queryKey: ["archived-quotations", page, pageSize, search, status],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("quotes")
        .select("*", { count: "exact" });

      if (search.trim()) {
        const s = search.trim();
        query = query.or(`quote_number.ilike.%${s}%,salesperson.ilike.%${s}%,metadata->>customer_name.ilike.%${s}%,metadata->>odoo_customer.ilike.%${s}%`);
      }

      if (status && status !== "all") {
        // Internal statuses use `status` column, Odoo statuses use `odoo_status`
        const internalStatuses = ["draft", "sent", "accepted", "declined", "cancelled"];
        if (internalStatuses.includes(status)) {
          query = query.eq("status", status);
        } else {
          query = query.eq("odoo_status", status);
        }
      }

      query = query.order("created_at", { ascending: false }).range(from, to);

      const { data: rows, error, count } = await query;
      if (error) throw error;

      return {
        rows: rows ?? [],
        totalCount: count ?? 0,
      };
    },
  });

  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return {
    quotations: data?.rows ?? [],
    isLoading,
    totalCount,
    totalPages,
  };
}
