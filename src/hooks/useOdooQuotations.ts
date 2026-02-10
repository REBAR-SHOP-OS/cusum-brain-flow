import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export function useOdooQuotations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

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

  const syncQuotations = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-odoo-quotations");
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["odoo-quotations"] });

      if (data.synced > 0) {
        toast({
          title: `${data.synced} quotation${data.synced > 1 ? "s" : ""} synced`,
          description: `Total: ${data.total} fetched, ${data.skipped} already existed${data.remaining ? " (more remaining, run again)" : ""}`,
        });
      } else {
        toast({
          title: "No new quotations",
          description: `${data.total} fetched, ${data.skipped} already synced`,
        });
      }

      return data;
    } catch (err) {
      console.error("Quotation sync error:", err);
      toast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : "Failed to sync quotations",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return { quotations, isLoading, isSyncing, syncQuotations };
}
