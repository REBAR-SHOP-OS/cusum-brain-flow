import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function invoke(action: string, params: Record<string, unknown> = {}) {
  return supabase.functions.invoke("semrush-api", { body: { action, ...params } });
}

export function useSemrushSync() {
  const qc = useQueryClient();

  const syncDomain = useMutation({
    mutationFn: async ({ domain_id, domain }: { domain_id: string; domain: string }) => {
      const [overviewRes, organicRes] = await Promise.all([
        invoke("domain_overview", { domain_id, domain }),
        invoke("domain_organic", { domain_id, domain, limit: 500 }),
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
      const { data, error } = await invoke("backlinks_overview", { domain });
      if (error) throw error;
      return data;
    },
    onError: (e: any) => toast.error(`Backlinks fetch failed: ${e.message}`),
  });

  const researchKeyword = useMutation({
    mutationFn: async ({ keyword }: { keyword: string }) => {
      const { data, error } = await invoke("keyword_overview", { keyword });
      if (error) throw error;
      return data?.data;
    },
    onError: (e: any) => toast.error(`Keyword research failed: ${e.message}`),
  });

  /**
   * Pull EVERYTHING from SEMrush by firing individual lightweight edge function
   * calls in parallel from the client. This avoids edge function timeout limits.
   */
  const fullExport = useMutation({
    mutationFn: async ({ domain_id, domain }: { domain_id: string; domain: string }) => {
      const databases = ["us", "ca"];

      // Fire all calls in parallel — each is a separate lightweight edge function invocation
      const calls = databases.flatMap((db) => [
        invoke("domain_overview", { domain_id, domain, database: db }).then((r) => ({ db, type: "overview", ...r })),
        invoke("domain_organic", { domain_id, domain, database: db, limit: 500 }).then((r) => ({ db, type: "organic", ...r })),
        invoke("domain_competitors", { domain, database: db }).then((r) => ({ db, type: "competitors", ...r })),
        invoke("domain_adwords", { domain, database: db }).then((r) => ({ db, type: "adwords", ...r })),
        invoke("domain_rank_history", { domain, database: db }).then((r) => ({ db, type: "history", ...r })),
      ]);
      // Backlinks are domain-level (not db-specific), fire once
      calls.push(
        invoke("backlinks_overview", { domain }).then((r) => ({ db: "global", type: "backlinks", ...r })),
        invoke("backlinks_refdomains", { domain }).then((r) => ({ db: "global", type: "refdomains", ...r })),
      );

      const results = await Promise.allSettled(calls);

      // Tally successes
      const summary: Record<string, number> = {};
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.data?.success) {
          const key = `${r.value.type}_${r.value.db}`;
          summary[key] = r.value.data.count ?? r.value.data.keywords_synced ?? 1;
        }
      }

      const totalKw = (summary["organic_us"] || 0) + (summary["organic_ca"] || 0);
      const failed = results.filter((r) => r.status === "rejected").length;

      return { summary, totalKw, failed };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["seo-domain"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-kw-stats"] });
      qc.invalidateQueries({ queryKey: ["seo-ai-keywords"] });
      toast.success(
        `Full SEMrush export done! ${data.totalKw} keywords (US+CA) saved.` +
          (data.failed > 0 ? ` ${data.failed} calls had errors.` : ""),
        { duration: 10000 },
      );
    },
    onError: (e: any) => toast.error(`Full export failed: ${e.message}`),
  });

  return { syncDomain, fetchBacklinks, researchKeyword, fullExport };
}
