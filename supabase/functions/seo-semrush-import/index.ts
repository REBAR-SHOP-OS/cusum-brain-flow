import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authErr } = await createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const { domain_id, ideas, traffic } = await req.json();
    if (!domain_id) throw new Error("domain_id required");

    // Verify domain exists
    const { data: domain } = await supabase.from("seo_domains").select("id, company_id").eq("id", domain_id).single();
    if (!domain) throw new Error("Domain not found");

    let keywordsUpserted = 0;
    let pagesUpserted = 0;
    let insightsCreated = 0;

    // Process ideas
    if (ideas?.length) {
      // Group by keyword
      const kwMap = new Map<string, { priority: number; url: string; ideas: string[] }>();
      const pageIssues = new Map<string, number>();

      for (const row of ideas) {
        const kw = (row.keyword || "").trim().toLowerCase();
        const url = (row.url || "").trim();
        const idea = (row.idea || "").trim();
        if (!kw) continue;

        if (!kwMap.has(kw)) {
          kwMap.set(kw, { priority: row.priority || 0, url, ideas: [] });
        }
        const entry = kwMap.get(kw)!;
        if (idea) entry.ideas.push(idea);
        if (row.priority > entry.priority) entry.priority = row.priority;

        if (url) {
          pageIssues.set(url, (pageIssues.get(url) || 0) + 1);
        }
      }

      // Upsert keywords into seo_keyword_ai
      for (const [keyword, info] of kwMap) {
        const { error } = await supabase.from("seo_keyword_ai").upsert({
          domain_id,
          keyword,
          top_page: info.url || null,
          opportunity_score: info.priority,
          status: "opportunity",
          sources: ["seo_tools"],
          source_count: 1,
        }, { onConflict: "domain_id,keyword" });
        if (!error) keywordsUpserted++;
      }

      // Upsert pages into seo_page_ai
      for (const [url, issueCount] of pageIssues) {
        const { error } = await supabase.from("seo_page_ai").upsert({
          domain_id,
          url,
          seo_score: Math.max(0, 100 - issueCount * 15),
          issues_json: { semrush_issues: issueCount },
          cwv_status: "unknown",
        }, { onConflict: "domain_id,url" });
        if (!error) pagesUpserted++;
      }

      // Create insights from ideas
      for (const [keyword, info] of kwMap) {
        for (const idea of info.ideas) {
          const isRisk = idea.toLowerCase().includes("bounce") || idea.toLowerCase().includes("couldn't find") || idea.toLowerCase().includes("low");
          const { error } = await supabase.from("seo_insight").insert({
            domain_id,
            entity_type: "keyword",
            entity_id: keyword,
            insight_type: isRisk ? "risk" : "action",
            explanation_text: `[${keyword}] ${idea}`,
            confidence_score: Math.min(1, (info.priority || 0.5) / 4),
            source: "semrush",
          });
          if (!error) insightsCreated++;
        }
      }
    }

    // Update traffic stats
    if (traffic) {
      await supabase.from("seo_domains").update({
        visits_monthly: traffic.visits || null,
        unique_visitors_monthly: traffic.unique_visitors || null,
        pages_per_visit: traffic.pages_per_visit || null,
        avg_visit_duration_seconds: traffic.avg_duration_seconds || null,
        bounce_rate: traffic.bounce_rate || null,
        visits_change_pct: traffic.visits_change_pct || null,
        visitors_change_pct: traffic.visitors_change_pct || null,
        traffic_snapshot_month: traffic.month || null,
      }).eq("id", domain_id);
    }

    return new Response(JSON.stringify({
      success: true,
      keywords_upserted: keywordsUpserted,
      pages_upserted: pagesUpserted,
      insights_created: insightsCreated,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
