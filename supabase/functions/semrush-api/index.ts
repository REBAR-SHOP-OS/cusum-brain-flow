import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Temporary hardcoded key – will move to secret once dialog paste is fixed
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
    throw new Error(`SEMrush API error ${res.status}: ${body}`);
  }
  const text = await res.text();
  if (text.startsWith("ERROR")) throw new Error(`SEMrush: ${text}`);
  return parseSemrushCsv(text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, domain_id, domain, keyword, database = "us" } = await req.json();

    if (action === "domain_overview") {
      const rows = await semrushFetch("/", {
        type: "domain_ranks",
        domain,
        database,
        export_columns: "Dn,Rk,Or,Ot,Oc,Ad,At,Ac",
      });
      const r = rows[0] || {};
      // Update seo_domains with authority/traffic stats
      if (domain_id) {
        await supabase.from("seo_domains").update({
          semrush_authority_score: Number(r["Rk"] || 0),
          semrush_organic_keywords: Number(r["Or"] || 0),
          semrush_organic_traffic: Number(r["Ot"] || 0),
          semrush_organic_cost: Number(r["Oc"] || 0),
          last_semrush_sync: new Date().toISOString(),
        }).eq("id", domain_id);
      }
      return new Response(JSON.stringify({ success: true, data: r }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "domain_organic") {
      const rows = await semrushFetch("/", {
        type: "domain_organic",
        domain,
        database,
        display_limit: "100",
        export_columns: "Ph,Po,Nq,Cp,Co,Tr,Tc,Nr,Td,Kd,Ur",
      });

      if (domain_id && rows.length) {
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
          sources: ["semrush"],
          source_count: 1,
          opportunity_score: Math.max(0, 100 - Number(r["Kd"] || 50)) * (Number(r["Nq"] || 0) > 100 ? 1.5 : 1),
          status: Number(r["Po"] || 99) <= 3 ? "winner" : Number(r["Po"] || 99) <= 10 ? "opportunity" : "stagnant",
          intent: "informational",
          last_synced_at: new Date().toISOString(),
        }));

        const { error: upsErr } = await supabase
          .from("seo_keyword_ai")
          .upsert(upserts, { onConflict: "domain_id,keyword", ignoreDuplicates: false });
        if (upsErr) console.error("Upsert error:", upsErr);
      }

      return new Response(JSON.stringify({ success: true, keywords_synced: rows.length, data: rows.slice(0, 10) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "backlinks_overview") {
      const rows = await semrushFetch("/analytics/v1/", {
        type: "backlinks_overview",
        target: domain,
        target_type: "root_domain",
        export_columns: "total,domains_num,urls_num,ips_num,follows_num,nofollows_num,texts_num,images_num",
      });
      const r = rows[0] || {};
      return new Response(JSON.stringify({ success: true, data: r }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "keyword_overview") {
      if (!keyword) throw new Error("keyword is required");
      const rows = await semrushFetch("/", {
        type: "phrase_all",
        phrase: keyword,
        database,
        export_columns: "Ph,Nq,Cp,Co,Nr,Td,Kd",
      });
      const r = rows[0] || {};
      return new Response(JSON.stringify({
        success: true,
        data: {
          keyword: r["Ph"] || keyword,
          volume: Number(r["Nq"] || 0),
          cpc: Number(r["Cp"] || 0),
          competition: Number(r["Co"] || 0),
          results: Number(r["Nr"] || 0),
          trend: Number(r["Td"] || 0),
          difficulty: Number(r["Kd"] || 0),
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("semrush-api error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
