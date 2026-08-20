import { handleRequest } from "../_shared/requestHandler.ts";
import { json } from "../_shared/auth.ts";

const WINCHER_BASE = "https://api.wincher.com/v1";

async function wincherFetch(path: string, token: string, opts: { method?: string; body?: unknown } = {}) {
  const url = `${WINCHER_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const res = await fetch(url, {
    method: opts.method || "GET",
    headers,
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") || "5");
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return wincherFetch(path, token, opts);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wincher API ${res.status}: ${text}`);
  }
  return res.json();
}

async function paginateKeywords(websiteId: number, token: string): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const data = await wincherFetch(
      `/websites/${websiteId}/keywords?include_ranking=true&limit=${limit}&offset=${offset}`,
      token
    );
    const rows = data?.data || data || [];
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  return all;
}

Deno.serve((req) =>
  handleRequest(req, async ({ userId, serviceClient: sb, body }) => {
    const token = Deno.env.get("WINCHER_API_KEY");
    if (!token) throw new Error("WINCHER_API_KEY not configured");

    const { action, domain_id, website_id } = body;

    // Resolve company_id from user profile
    const { data: profile } = await sb.from("profiles").select("company_id").eq("user_id", userId).single();
    const companyId = profile?.company_id;
    if (!companyId) throw new Error("No company profile found for Wincher sync");

    if (action === "list_websites") {
      const data = await wincherFetch("/websites?include_ranking=true", token);
      return { success: true, data };
    }

    if (action === "full_export") {
      if (!domain_id) throw new Error("domain_id required");

      // 1. List websites
      const websites = await wincherFetch("/websites?include_ranking=true", token);
      const siteList = websites?.data || websites || [];
      if (!siteList.length) return { success: true, message: "No websites found in Wincher" };

      const site = website_id ? siteList.find((s: any) => s.id === website_id) : siteList[0];
      if (!site) throw new Error("Website not found");
      const wId = site.id;

      // 2. Pull all data in parallel
      const [keywords, history, competitors, competitorSummaries, groups, annotations] = await Promise.all([
        paginateKeywords(wId, token),
        wincherFetch(`/websites/${wId}/ranking-history`, token, { method: "POST", body: { groups: true, competitors: true } }).catch(() => null),
        wincherFetch(`/websites/${wId}/competitors`, token).catch(() => null),
        wincherFetch(`/websites/${wId}/competitors/ranking-summaries?include_ranking=true`, token).catch(() => null),
        wincherFetch(`/websites/${wId}/groups?include_ranking=true`, token).catch(() => null),
        wincherFetch(`/websites/${wId}/annotations`, token).catch(() => null),
      ]);

      // 3. Update seo_domains with website-level data
      await sb.from("seo_domains").update({
        wincher_website_id: wId,
        wincher_data_json: site,
        wincher_rank_history_json: history,
        wincher_competitors_json: { competitors, summaries: competitorSummaries },
        wincher_groups_json: groups,
        wincher_annotations_json: annotations,
        wincher_synced_at: new Date().toISOString(),
      }).eq("id", domain_id);

      // 4. Upsert keywords
      let kwUpserted = 0;
      for (const kw of keywords) {
        const keyword = (kw.keyword || kw.name || "").trim().toLowerCase();
        if (!keyword) continue;

        const ranking = kw.ranking || {};
        const upsertData: Record<string, unknown> = {
          company_id: companyId,
          domain_id,
          keyword,
          wincher_keyword_id: kw.id,
          wincher_position: ranking.position ?? null,
          wincher_position_change: ranking.position_change ?? null,
          wincher_traffic: ranking.traffic ?? null,
          wincher_difficulty: kw.difficulty ?? null,
          wincher_cpc: kw.cpc?.high ?? kw.cpc ?? null,
          wincher_best_position: ranking.best_position ?? null,
          wincher_serp_features_json: kw.serp_features || ranking.serp_features || null,
          wincher_ranking_pages_json: ranking.ranking_pages || null,
          wincher_synced_at: new Date().toISOString(),
          status: "opportunity",
          sources: ["wincher"],
          source_count: 1,
        };

        if (kw.intents?.length) {
          const topIntent = kw.intents.sort((a: any, b: any) => (b.probability || 0) - (a.probability || 0))[0];
          upsertData.intent = topIntent.intent?.toLowerCase() || null;
        }

        const { error } = await sb.from("seo_keyword_ai").upsert(upsertData, { onConflict: "domain_id,keyword" });
        if (error) {
          console.error("Upsert error for keyword:", keyword, error.message);
        } else {
          kwUpserted++;
        }
      }

      // 5. Pull keyword history for top 20 keywords (by traffic)
      const topKw = keywords
        .filter((k: any) => k.ranking?.position)
        .sort((a: any, b: any) => (b.ranking?.traffic || 0) - (a.ranking?.traffic || 0))
        .slice(0, 20);

      let historyPulled = 0;
      for (const kw of topKw) {
        try {
          const kwHistory = await wincherFetch(`/websites/${wId}/keywords/${kw.id}/ranking-history`, token);
          await sb.from("seo_keyword_ai").update({
            wincher_position_history_json: kwHistory,
          }).eq("domain_id", domain_id).eq("wincher_keyword_id", kw.id);
          historyPulled++;
        } catch { /* skip */ }
      }

      return {
        success: true,
        website: site.domain || site.url,
        keywords_synced: kwUpserted,
        keyword_histories_pulled: historyPulled,
        total_keywords_found: keywords.length,
      };
    }

    throw new Error(`Unknown action: ${action}`);
  }, { functionName: "wincher-sync", requireCompany: false, wrapResult: false })
);
