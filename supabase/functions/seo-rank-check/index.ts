import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const dfLogin = Deno.env.get("DATAFORSEO_LOGIN");
    const dfPassword = Deno.env.get("DATAFORSEO_PASSWORD");

    if (!dfLogin || !dfPassword) {
      return new Response(
        JSON.stringify({
          error: "DataForSEO not configured. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD secrets.",
          fallback: "Module will use GSC average position data instead.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { domain_id, keyword_ids } = await req.json();
    if (!domain_id) {
      return new Response(JSON.stringify({ error: "domain_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get keywords to check
    let query = supabase
      .from("seo_keywords")
      .select("*")
      .eq("domain_id", domain_id)
      .eq("active", true);

    if (keyword_ids?.length) {
      query = query.in("id", keyword_ids);
    }

    const { data: keywords } = await query.limit(100);
    if (!keywords?.length) {
      return new Response(JSON.stringify({ success: true, checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: domain } = await supabase
      .from("seo_domains")
      .select("company_id, domain")
      .eq("id", domain_id)
      .single();
    if (!domain) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    let checked = 0;

    // Build DataForSEO tasks
    const tasks = keywords.map((kw: any) => ({
      keyword: kw.keyword,
      location_code: kw.country === "AU" ? 2036 : kw.country === "US" ? 2840 : 2036,
      language_code: "en",
      device: kw.device === "mobile" ? "mobile" : "desktop",
      depth: 30,
      tag: kw.id,
    }));

    // Send to DataForSEO
    const dfResponse = await fetch(
      "https://api.dataforseo.com/v3/serp/google/organic/live/regular",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${dfLogin}:${dfPassword}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tasks),
      }
    );

    if (!dfResponse.ok) {
      const errText = await dfResponse.text();
      console.error("DataForSEO error:", errText);
      return new Response(
        JSON.stringify({ error: `DataForSEO API error: ${dfResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dfData = await dfResponse.json();

    for (const task of dfData.tasks || []) {
      if (task.status_code !== 20000) continue;

      const keywordId = task.data?.tag;
      if (!keywordId) continue;

      const items = task.result?.[0]?.items || [];
      // Find our domain in results
      const ourResult = items.find(
        (item: any) =>
          item.type === "organic" &&
          item.domain?.includes(domain.domain)
      );

      await supabase.from("seo_rank_history").upsert(
        {
          keyword_id: keywordId,
          date: today,
          position: ourResult?.rank_absolute || null,
          url_found: ourResult?.url || null,
          source: "serp",
          company_id: domain.company_id,
        },
        { onConflict: "keyword_id,date,source" }
      );
      checked++;
    }

    return new Response(
      JSON.stringify({ success: true, checked, total_keywords: keywords.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("seo-rank-check error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
