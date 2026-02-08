import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCompanyId() {
  const { data: companyId, isLoading } = useQuery({
    queryKey: ["my_company_id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.company_id ?? null;
    },
    staleTime: 1000 * 60 * 10, // cache for 10 minutes
  });

  return { companyId, isLoading };
}

/**
 * Get company_id for use outside React components (e.g. service functions).
 * Returns null if no authenticated user or no profile found.
 */
export async function getCompanyId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.company_id ?? null;
}
