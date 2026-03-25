import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

const SEMRUSH_API_KEY = "958fa1b9cc655056d7057ddb9b22ae8f";
const SEMRUSH_BASE = "https://api.semrush.com";

function parseSemrushCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(";").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(";");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (vals[i] || "").trim();
    });
    return obj;
  });
}

async function semrushFetch(endpoint: string, params: Record<string, string>): Promise<Record<string, string>[]> {
  const url = new URL(endpoint, SEMRUSH_BASE);
  url.searchParams.set("key", SEMRUSH_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    // Graceful handling for zero balance
    if (body.includes("API UNITS BALANCE IS ZERO") || body.includes("ERROR 132")) {
      throw new Error("SEMRUSH_NO_UNITS");
    }
    throw new Error(`SEMrush API error ${res.status}: ${body}`);
  }
  const text = await res.text();
  if (text.startsWith("ERROR")) {
    if (text.includes("NOTHING FOUND")) return [];
    if (text.includes("API UNITS BALANCE IS ZERO") || text.includes("ERROR 132")) {
      throw new Error("SEMRUSH_NO_UNITS");
    }
    throw new Error(`SEMrush: ${text}`);
  }
  return parseSemrushCsv(text);
}

function jsonResp(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) {
      return jsonResp({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, domain_id, domain, keyword, database = "us", limit } = await req.json();

    // ── Domain Overview ──
    if (action === "domain_overview") {
      const rows = await semrushFetch("/", {
        type: "domain_ranks",
        domain,
        database,
        export_columns: "Dn,Rk,Or,Ot,Oc,Ad,At,Ac",
      });
      const r = rows[0] || {};
      if (domain_id) {
        await supabase.from("seo_domains").update({
          semrush_authority_score: Number(r["Rk"] || 0),
          semrush_organic_keywords: Number(r["Or"] || 0),
          semrush_organic_traffic: Number(r["Ot"] || 0),
          semrush_organic_cost: Number(r["Oc"] || 0),
          last_semrush_sync: new Date().toISOString(),
        }).eq("id", domain_id);
      }
      return jsonResp({ success: true, data: r });
    }

    // ── Domain Overview All Databases ──
    if (action === "domain_overview_all") {
      const rows = await semrushFetch("/", {
        type: "domain_ranks",
        domain,
        database: "us",
        export_columns: "Dn,Rk,Or,Ot,Oc,Ad,At,Ac",
      });
      return jsonResp({ success: true, count: rows.length, data: rows });
    }

    // ── Domain Organic Keywords (up to 10,000) ──
    if (action === "domain_organic") {
      const displayLimit = String(limit || 10000);
      const rows = await semrushFetch("/", {
        type: "domain_organic",
        domain,
        database,
        display_limit: displayLimit,
        export_columns: "Ph,Po,Nq,Cp,Co,Tr,Tc,Nr,Td,Kd,Ur,In",
      });

      if (domain_id && rows.length) {
        const intentMap: Record<string, string> = {
          "0": "informational",
          "1": "navigational",
          "2": "commercial",
          "3": "transactional",
        };
        const upserts = rows.map((r) => ({
          domain_id,
          keyword: r["Ph"] || "",
          avg_position: Number(r["Po"] || 0),
          search_volume: Number(r["Nq"] || 0),
          cpc: Number(r["Cp"] || 0),
          competition: Number(r["Co"] || 0),
          traffic_pct: Number(r["Tr"] || 0),
          traffic_cost: Number(r["Tc"] || 0),
          results_count: Number(r["Nr"] || 0),
          trend_score: Number(r["Td"] || 0),
          keyword_difficulty: Number(r["Kd"] || 0),
          url: r["Ur"] || null,
          intent: intentMap[r["In"]] || "informational",
          sources: ["semrush"],
          source_count: 1,
          opportunity_score: Math.max(0, 100 - Number(r["Kd"] || 50)) * (Number(r["Nq"] || 0) > 100 ? 1.5 : 1),
          status: Number(r["Po"] || 99) <= 3 ? "winner" : Number(r["Po"] || 99) <= 10 ? "opportunity" : "stagnant",
          last_synced_at: new Date().toISOString(),
        }));

        for (let i = 0; i < upserts.length; i += 200) {
          const chunk = upserts.slice(i, i + 200);
          const { error: upsErr } = await supabase
            .from("seo_keyword_ai")
            .upsert(chunk, { onConflict: "domain_id,keyword", ignoreDuplicates: false });
          if (upsErr) console.error("Upsert error (chunk):", upsErr);
        }
      }

      return jsonResp({ success: true, keywords_synced: rows.length, data: rows.slice(0, 10) });
    }

    // ── Domain Organic Pages → save to seo_page_ai ──
    if (action === "domain_organic_pages") {
      const displayLimit = String(limit || 5000);
      const rows = await semrushFetch("/", {
        type: "domain_organic_organic",
        domain,
        database,
        display_limit: displayLimit,
        export_columns: "Ur,Nq,Tr,Tc,Kw",
      });

      if (domain_id && rows.length) {
        for (let i = 0; i < rows.length; i += 200) {
          const chunk = rows.slice(i, i + 200).map((r) => ({
            domain_id,
            url: r["Ur"] || "",
            seo_score: Math.min(100, Math.round((Number(r["Tr"] || 0)) * 10)),
            issues_json: {
              organic_keywords: Number(r["Kw"] || 0),
              traffic: Number(r["Tr"] || 0),
              traffic_cost: Number(r["Tc"] || 0),
              search_volume: Number(r["Nq"] || 0),
            },
            cwv_status: "unknown",
          }));
          await supabase.from("seo_page_ai").upsert(chunk, { onConflict: "domain_id,url", ignoreDuplicates: false });
        }
      }

      return jsonResp({ success: true, count: rows.length, data: rows.slice(0, 10) });
    }

    // ── Related Keywords → save to seo_keyword_ai ──
    if (action === "related_keywords") {
      if (!keyword) throw new Error("keyword is required");
      const displayLimit = String(limit || 200);
      const rows = await semrushFetch("/", {
        type: "phrase_related",
        phrase: keyword,
        database,
        display_limit: displayLimit,
        export_columns: "Ph,Nq,Cp,Co,Kd,Nr,Td,In",
      });

      if (domain_id && rows.length) {
        const intentMap: Record<string, string> = { "0": "informational", "1": "navigational", "2": "commercial", "3": "transactional" };
        const upserts = rows.map((r) => ({
          domain_id,
          keyword: r["Ph"] || "",
          search_volume: Number(r["Nq"] || 0),
          cpc: Number(r["Cp"] || 0),
          competition: Number(r["Co"] || 0),
          keyword_difficulty: Number(r["Kd"] || 0),
          results_count: Number(r["Nr"] || 0),
          trend_score: Number(r["Td"] || 0),
          intent: intentMap[r["In"]] || "informational",
          sources: ["semrush_related"],
          source_count: 1,
          opportunity_score: Math.max(0, 100 - Number(r["Kd"] || 50)) * (Number(r["Nq"] || 0) > 100 ? 1.5 : 1),
          status: "opportunity",
          last_synced_at: new Date().toISOString(),
        }));
        for (let i = 0; i < upserts.length; i += 200) {
          await supabase.from("seo_keyword_ai").upsert(upserts.slice(i, i + 200), { onConflict: "domain_id,keyword", ignoreDuplicates: false });
        }
      }

      return jsonResp({ success: true, count: rows.length, data: rows.slice(0, 10) });
    }

    // ── Broad Match Keywords → save to seo_keyword_ai ──
    if (action === "broad_match_keywords") {
      if (!keyword) throw new Error("keyword is required");
      const displayLimit = String(limit || 200);
      const rows = await semrushFetch("/", {
        type: "phrase_fullsearch",
        phrase: keyword,
        database,
        display_limit: displayLimit,
        export_columns: "Ph,Nq,Cp,Co,Kd,Nr,Td,In",
      });

      if (domain_id && rows.length) {
        const intentMap: Record<string, string> = { "0": "informational", "1": "navigational", "2": "commercial", "3": "transactional" };
        const upserts = rows.map((r) => ({
          domain_id,
          keyword: r["Ph"] || "",
          search_volume: Number(r["Nq"] || 0),
          cpc: Number(r["Cp"] || 0),
          competition: Number(r["Co"] || 0),
          keyword_difficulty: Number(r["Kd"] || 0),
          results_count: Number(r["Nr"] || 0),
          trend_score: Number(r["Td"] || 0),
          intent: intentMap[r["In"]] || "informational",
          sources: ["semrush_broad"],
          source_count: 1,
          opportunity_score: Math.max(0, 100 - Number(r["Kd"] || 50)) * (Number(r["Nq"] || 0) > 100 ? 1.5 : 1),
          status: "opportunity",
          last_synced_at: new Date().toISOString(),
        }));
        for (let i = 0; i < upserts.length; i += 200) {
          await supabase.from("seo_keyword_ai").upsert(upserts.slice(i, i + 200), { onConflict: "domain_id,keyword", ignoreDuplicates: false });
        }
      }

      return jsonResp({ success: true, count: rows.length, data: rows.slice(0, 10) });
    }

    // ── Phrase Questions → save to seo_keyword_ai ──
    if (action === "phrase_questions") {
      if (!keyword) throw new Error("keyword is required");
      const displayLimit = String(limit || 200);
      const rows = await semrushFetch("/", {
        type: "phrase_questions",
        phrase: keyword,
        database,
        display_limit: displayLimit,
        export_columns: "Ph,Nq,Cp,Co,Kd,Nr,Td",
      });

      if (domain_id && rows.length) {
        const upserts = rows.map((r) => ({
          domain_id,
          keyword: r["Ph"] || "",
          search_volume: Number(r["Nq"] || 0),
          cpc: Number(r["Cp"] || 0),
          competition: Number(r["Co"] || 0),
          keyword_difficulty: Number(r["Kd"] || 0),
          results_count: Number(r["Nr"] || 0),
          trend_score: Number(r["Td"] || 0),
          intent: "informational",
          sources: ["semrush_questions"],
          source_count: 1,
          opportunity_score: Math.max(0, 100 - Number(r["Kd"] || 50)) * (Number(r["Nq"] || 0) > 100 ? 1.5 : 1),
          status: "opportunity",
          last_synced_at: new Date().toISOString(),
        }));
        for (let i = 0; i < upserts.length; i += 200) {
          await supabase.from("seo_keyword_ai").upsert(upserts.slice(i, i + 200), { onConflict: "domain_id,keyword", ignoreDuplicates: false });
        }
      }

      return jsonResp({ success: true, count: rows.length, data: rows.slice(0, 10) });
    }

    // ── Backlinks Overview ──
    if (action === "backlinks_overview") {
      const rows = await semrushFetch("/analytics/v1/", {
        type: "backlinks_overview",
        target: domain,
        target_type: "root_domain",
        export_columns: "total,domains_num,urls_num,ips_num,follows_num,nofollows_num,texts_num,images_num",
      });
      const r = rows[0] || {};

      // Persist to seo_domains
      if (domain_id) {
        await supabase.from("seo_domains").update({
          semrush_backlinks_json: r,
        }).eq("id", domain_id);
      }

      return jsonResp({ success: true, data: r });
    }

    // ── Backlinks List → persist to seo_domains ──
    if (action === "backlinks_list") {
      const displayLimit = String(limit || 500);
      const rows = await semrushFetch("/analytics/v1/", {
        type: "backlinks",
        target: domain,
        target_type: "root_domain",
        display_limit: displayLimit,
        export_columns: "source_url,source_title,target_url,anchor,external_num,internal_num,first_seen,last_seen",
      });

      if (domain_id && rows.length) {
        await supabase.from("seo_domains").update({
          semrush_backlinks_json: { overview: null, links: rows },
        }).eq("id", domain_id);
      }

      return jsonResp({ success: true, count: rows.length, data: rows.slice(0, 10) });
    }

    // ── Referring Domains List ──
    if (action === "backlinks_refdomains") {
      const displayLimit = String(limit || 200);
      const rows = await semrushFetch("/analytics/v1/", {
        type: "backlinks_refdomains",
        target: domain,
        target_type: "root_domain",
        display_limit: displayLimit,
        export_columns: "domain_ascore,domain,backlinks_num,ip,country,first_seen,last_seen",
      });
      return jsonResp({ success: true, count: rows.length, data: rows });
    }

    // ── Organic Competitors → persist to seo_domains ──
    if (action === "domain_competitors") {
      const displayLimit = String(limit || 50);
      const rows = await semrushFetch("/", {
        type: "domain_organic_organic",
        domain,
        database,
        display_limit: displayLimit,
        export_columns: "Dn,Cr,Np,Or,Ot,Oc,Ad",
      });

      if (domain_id && rows.length) {
        await supabase.from("seo_domains").update({
          semrush_competitors_json: rows,
        }).eq("id", domain_id);
      }

      return jsonResp({ success: true, count: rows.length, data: rows });
    }

    // ── Paid Keywords ──
    if (action === "domain_adwords") {
      const displayLimit = String(limit || 200);
      const rows = await semrushFetch("/", {
        type: "domain_adwords",
        domain,
        database,
        display_limit: displayLimit,
        export_columns: "Ph,Po,Nq,Cp,Co,Tr,Tc,Nr,Td,Ur,Tt,Ds,Vu",
      });
      return jsonResp({ success: true, count: rows.length, data: rows });
    }

    // ── Domain Rank History → persist to seo_domains ──
    if (action === "domain_rank_history") {
      const rows = await semrushFetch("/", {
        type: "domain_rank_history",
        domain,
        database,
        display_limit: "24",
        export_columns: "Dt,Rk,Or,Ot,Oc,Ad,At,Ac",
      });

      if (domain_id && rows.length) {
        await supabase.from("seo_domains").update({
          semrush_rank_history_json: rows,
        }).eq("id", domain_id);
      }

      return jsonResp({ success: true, count: rows.length, data: rows });
    }

    // ── Keyword Overview ──
    if (action === "keyword_overview") {
      if (!keyword) throw new Error("keyword is required");
      const rows = await semrushFetch("/", {
        type: "phrase_all",
        phrase: keyword,
        database,
        export_columns: "Ph,Nq,Cp,Co,Nr,Td,Kd,In",
      });
      const r = rows[0] || {};
      const intentMap: Record<string, string> = { "0": "informational", "1": "navigational", "2": "commercial", "3": "transactional" };
      return jsonResp({
        success: true,
        data: {
          keyword: r["Ph"] || keyword,
          volume: Number(r["Nq"] || 0),
          cpc: Number(r["Cp"] || 0),
          competition: Number(r["Co"] || 0),
          results: Number(r["Nr"] || 0),
          trend: Number(r["Td"] || 0),
          difficulty: Number(r["Kd"] || 0),
          intent: intentMap[r["In"]] || "unknown",
        },
      });
    }

    return jsonResp({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("semrush-api error:", e);
    // Special handling for zero balance
    if (e.message === "SEMRUSH_NO_UNITS") {
      return jsonResp({
        error: "SEMrush API units exhausted. Top up at semrush.com or wait for monthly reset.",
        code: "NO_UNITS",
      }, 402);
    }
    return jsonResp({ error: e.message }, 500);
  }
});
