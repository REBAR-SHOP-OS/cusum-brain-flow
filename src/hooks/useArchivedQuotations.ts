import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Read-only hook — returns archived quotations from the quotes table.
// These were originally imported from Odoo and are preserved as a historical archive.
export function useArchivedQuotations() {
  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["archived-quotations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("source", "odoo_sync")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return { quotations, isLoading };
}
