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
          body: { action: "domain_organic", domain_id, domain, limit: 500 },
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

  /** Pull EVERYTHING from SEMrush: US+CA organic, backlinks, competitors, paid, history */
  const fullExport = useMutation({
    mutationFn: async ({ domain_id, domain }: { domain_id: string; domain: string }) => {
      const { data, error } = await supabase.functions.invoke("semrush-api", {
        body: { action: "full_export", domain_id, domain },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["seo-domain"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-kw-stats"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-keywords"] });
      const s = data?.summary || {};
      toast.success(
        `Full SEMrush export complete!\n` +
        `${s.total_organic_keywords || 0} keywords (US+CA)\n` +
        `${s.us_competitors || 0} US competitors, ${s.ca_competitors || 0} CA competitors\n` +
        `${s.referring_domains || 0} referring domains\n` +
        `${s.paid_keywords_us || 0} paid keywords\n` +
        `${s.rank_history_months || 0} months of rank history`,
        { duration: 10000 }
      );
    },
    onError: (e: any) => toast.error(`Full export failed: ${e.message}`),
  });

  return { syncDomain, fetchBacklinks, researchKeyword, fullExport };
}
