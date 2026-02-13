import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Read-only hook — Odoo sync has been decommissioned.
// Quotation data is preserved as a historical archive in the quotes table.
export function useOdooQuotations() {
  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["odoo-quotations"],
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

  return { quotations, isLoading, isSyncing: false, syncQuotations: async () => {} };
}
