import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export function useCompanies(search?: string) {
  const { companyId } = useCompanyId();

  return useQuery({
    queryKey: ["companies", companyId, search],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("v_customers_clean" as any)
        .select("*")
        .eq("company_id", companyId!);
      if (search) {
        q = q.or(`display_name.ilike.%${search}%,company_name.ilike.%${search}%`);
      }
      q = q.order("display_name", { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown) as Array<{
        customer_id: string;
        display_name: string;
        company_name: string;
        normalized_name: string | null;
        phone: string | null;
        email: string | null;
        status: string | null;
        company_id: string;
        created_at: string;
      }>;
    },
    staleTime: 1000 * 60 * 2,
  });
}
