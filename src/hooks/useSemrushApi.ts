import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

async function invoke(action: string, params: Record<string, unknown> = {}) {
  const res = await supabase.functions.invoke("semrush-api", { body: { action, ...params } });
  // Supabase client wraps non-2xx as error — but the body may still contain structured JSON
  // For 402 NO_UNITS, the error object contains the context we need
  if (res.error) {
    // Try to parse the error context for NO_UNITS code
    const errMsg = res.error?.message || String(res.error);
    if (errMsg.includes("units exhausted") || errMsg.includes("NO_UNITS")) {
      throw new Error("SEMrush API units exhausted. Top up at semrush.com or wait for monthly reset.");
    }
    // Also check if data came through despite the error (some versions pass it)
    if (res.data?.code === "NO_UNITS") {
      throw new Error(res.data.error || "SEMrush API units exhausted.");
    }
    throw new Error(errMsg);
  }
  if (res.data?.code === "NO_UNITS") {
    throw new Error(res.data.error || "SEMrush API units exhausted.");
  }
  if (res.data?.error) throw new Error(res.data.error);
  return res;
}

/** Parse edge function response */
function handleResponse(res: { data: any; error: any }) {
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export function useSemrushSync() {
  const qc = useQueryClient();

  const invalidateSeo = () => {
    qc.invalidateQueries({ queryKey: ["seo-domain"] });
    qc.invalidateQueries({ queryKey: ["seo-ai-kw-stats"] });
    qc.invalidateQueries({ queryKey: ["seo-ai-keywords"] });
    qc.invalidateQueries({ queryKey: ["seo-ai-pages"] });
  };

  const syncDomain = useMutation({
    mutationFn: async ({ domain_id, domain }: { domain_id: string; domain: string }) => {
      const [overviewRes, organicRes] = await Promise.all([
        invoke("domain_overview", { domain_id, domain }),
        invoke("domain_organic", { domain_id, domain, limit: 10000 }),
      ]);
      handleResponse(overviewRes);
      const organic = handleResponse(organicRes);
      return { organic };
    },
    onSuccess: (data) => {
      invalidateSeo();
      toast.success(`SEMrush synced: ${data.organic?.keywords_synced || 0} keywords imported`);
    },
    onError: (e: any) => {
      if (e.message?.includes("units exhausted")) {
        toast.error("SEMrush API units exhausted. Top up at semrush.com or wait for monthly reset.");
      } else {
        toast.error(`SEMrush sync failed: ${e.message}`);
      }
    },
  });

  const fetchBacklinks = useMutation({
    mutationFn: async ({ domain }: { domain: string }) => {
      const res = await invoke("backlinks_overview", { domain });
      return handleResponse(res);
    },
    onError: (e: any) => toast.error(`Backlinks fetch failed: ${e.message}`),
  });

  const researchKeyword = useMutation({
    mutationFn: async ({ keyword }: { keyword: string }) => {
      const res = await invoke("keyword_overview", { keyword });
      return handleResponse(res)?.data;
    },
    onError: (e: any) => toast.error(`Keyword research failed: ${e.message}`),
  });

  /**
   * Pull EVERYTHING from SEMrush — fires individual lightweight edge function
   * calls in parallel. Includes new endpoints for maximum data extraction.
   */
  const fullExport = useMutation({
    mutationFn: async ({ domain_id, domain, topKeywords = [] }: {
      domain_id: string;
      domain: string;
      topKeywords?: string[];
    }) => {
      const databases = ["us", "ca"];

      // Core calls per database
      const calls = databases.flatMap((db) => [
        invoke("domain_overview", { domain_id, domain, database: db }).then((r) => ({ db, type: "overview", ...r })),
        invoke("domain_organic", { domain_id, domain, database: db, limit: 10000 }).then((r) => ({ db, type: "organic", ...r })),
        invoke("domain_competitors", { domain_id, domain, database: db }).then((r) => ({ db, type: "competitors", ...r })),
        invoke("domain_adwords", { domain, database: db }).then((r) => ({ db, type: "adwords", ...r })),
        invoke("domain_rank_history", { domain_id, domain, database: db }).then((r) => ({ db, type: "history", ...r })),
        invoke("domain_organic_pages", { domain_id, domain, database: db, limit: 5000 }).then((r) => ({ db, type: "pages", ...r })),
      ]);

      // Backlinks (domain-level, not db-specific)
      calls.push(
        invoke("backlinks_overview", { domain_id, domain }).then((r) => ({ db: "global", type: "backlinks", ...r })),
        invoke("backlinks_refdomains", { domain }).then((r) => ({ db: "global", type: "refdomains", ...r })),
        invoke("backlinks_list", { domain_id, domain, limit: 500 }).then((r) => ({ db: "global", type: "backlinks_list", ...r })),
      );

      // Keyword research for top keywords (related, broad match, questions)
      const kwToResearch = topKeywords.slice(0, 5); // limit to 5 seed keywords to conserve units
      for (const kw of kwToResearch) {
        calls.push(
          invoke("related_keywords", { domain_id, keyword: kw, limit: 200 }).then((r) => ({ db: "us", type: "related", ...r })),
          invoke("broad_match_keywords", { domain_id, keyword: kw, limit: 200 }).then((r) => ({ db: "us", type: "broad", ...r })),
          invoke("phrase_questions", { domain_id, keyword: kw, limit: 200 }).then((r) => ({ db: "us", type: "questions", ...r })),
        );
      }

      const results = await Promise.allSettled(calls);

      // Tally successes
      const summary: Record<string, number> = {};
      let noUnitsCount = 0;
      for (const r of results) {
        if (r.status === "fulfilled") {
          const val = r.value;
          if (val.data?.code === "NO_UNITS") {
            noUnitsCount++;
            continue;
          }
          if (val.data?.success) {
            const key = `${val.type}_${val.db}`;
            summary[key] = val.data.count ?? val.data.keywords_synced ?? 1;
          }
        }
      }

      const totalKw = (summary["organic_us"] || 0) + (summary["organic_ca"] || 0);
      const totalPages = (summary["pages_us"] || 0) + (summary["pages_ca"] || 0);
      const failed = results.filter((r) => r.status === "rejected").length;

      return { summary, totalKw, totalPages, failed, noUnitsCount };
    },
    onSuccess: (data) => {
      invalidateSeo();
      if (data.noUnitsCount > 0) {
        toast.warning(
          `Export partially complete — ${data.noUnitsCount} calls skipped (API units exhausted). ` +
          `${data.totalKw} keywords, ${data.totalPages} pages saved.`,
          { duration: 15000 },
        );
      } else {
        toast.success(
          `Full SEMrush export done! ${data.totalKw} keywords + ${data.totalPages} pages (US+CA) saved.` +
            (data.failed > 0 ? ` ${data.failed} calls had errors.` : ""),
          { duration: 10000 },
        );
      }
    },
    onError: (e: any) => toast.error(`Full export failed: ${e.message}`),
  });

  return { syncDomain, fetchBacklinks, researchKeyword, fullExport };
}
