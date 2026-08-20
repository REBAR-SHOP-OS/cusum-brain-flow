import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useWincherSync() {
  const qc = useQueryClient();

  const invalidateSeo = () => {
    qc.invalidateQueries({ queryKey: ["seo-domain"] });
    qc.invalidateQueries({ queryKey: ["seo-ai-kw-stats"] });
    qc.invalidateQueries({ queryKey: ["seo-ai-keywords"] });
    qc.invalidateQueries({ queryKey: ["seo-ai-pages"] });
  };

  const syncAll = useMutation({
    mutationFn: async ({ domain_id, website_id }: { domain_id: string; website_id?: number }) => {
      toast.info("Starting Wincher full export… this may take a minute.", { duration: 10000 });
      const { data, error } = await supabase.functions.invoke("wincher-sync", {
        body: { action: "full_export", domain_id, website_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      invalidateSeo();
      toast.success(
        `Wincher sync complete! ${data.keywords_synced} keywords imported, ${data.keyword_histories_pulled} histories pulled from ${data.website}.`,
        { duration: 10000 },
      );
    },
    onError: (e: any) => toast.error(`Wincher sync failed: ${e.message}`),
  });

  const listWebsites = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("wincher-sync", {
        body: { action: "list_websites" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onError: (e: any) => toast.error(`Failed to list Wincher websites: ${e.message}`),
  });

  return { syncAll, listWebsites };
}
