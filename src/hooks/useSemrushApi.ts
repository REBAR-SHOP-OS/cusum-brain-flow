import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useSemrushSync() {
  const qc = useQueryClient();

  const syncDomain = useMutation({
    mutationFn: async ({ domain_id, domain }: { domain_id: string; domain: string }) => {
      // Run domain_overview + domain_organic in parallel
      const [overviewRes, organicRes] = await Promise.all([
        supabase.functions.invoke("semrush-api", {
          body: { action: "domain_overview", domain_id, domain },
        }),
        supabase.functions.invoke("semrush-api", {
          body: { action: "domain_organic", domain_id, domain },
        }),
      ]);
      if (overviewRes.error) throw overviewRes.error;
      if (organicRes.error) throw organicRes.error;
      return { overview: overviewRes.data, organic: organicRes.data };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["seo-domain"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-kw-stats"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-keywords"] });
      toast.success(`SEMrush synced: ${data.organic?.keywords_synced || 0} keywords imported`);
    },
    onError: (e: any) => toast.error(`SEMrush sync failed: ${e.message}`),
  });

  const fetchBacklinks = useMutation({
    mutationFn: async ({ domain }: { domain: string }) => {
      const { data, error } = await supabase.functions.invoke("semrush-api", {
        body: { action: "backlinks_overview", domain },
      });
      if (error) throw error;
      return data;
    },
    onError: (e: any) => toast.error(`Backlinks fetch failed: ${e.message}`),
  });

  const researchKeyword = useMutation({
    mutationFn: async ({ keyword }: { keyword: string }) => {
      const { data, error } = await supabase.functions.invoke("semrush-api", {
        body: { action: "keyword_overview", keyword },
      });
      if (error) throw error;
      return data?.data;
    },
    onError: (e: any) => toast.error(`Keyword research failed: ${e.message}`),
  });

  return { syncDomain, fetchBacklinks, researchKeyword };
}
