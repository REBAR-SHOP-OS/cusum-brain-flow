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

    const { domain_id, days = 28 } = await req.json();
    if (!domain_id) {
      return new Response(JSON.stringify({ error: "domain_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get domain
    const { data: domain, error: domainErr } = await supabase
      .from("seo_domains")
      .select("*")
      .eq("id", domain_id)
      .single();
    if (domainErr || !domain) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Google OAuth tokens from integration_tokens
    const { data: tokenRow } = await supabase
      .from("integration_tokens")
      .select("*")
      .eq("provider", "google")
      .eq("company_id", domain.company_id)
      .maybeSingle();

    if (!tokenRow?.access_token) {
      return new Response(
        JSON.stringify({ error: "Google OAuth not connected. Connect Google Search Console first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate date range
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3); // GSC data is delayed ~3 days
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    // Fetch GSC data
    const siteUrl = `sc-domain:${domain.domain}`;
    const gscResponse = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenRow.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ["query", "page", "date"],
          rowLimit: 5000,
        }),
      }
    );

    if (!gscResponse.ok) {
      const errBody = await gscResponse.text();
      console.error("GSC API error:", errBody);
      return new Response(
        JSON.stringify({ error: `GSC API error: ${gscResponse.status}`, details: errBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gscData = await gscResponse.json();
    const rows = gscData.rows || [];
    console.log(`GSC returned ${rows.length} rows`);

    // Get all keywords for this domain
    const { data: keywords } = await supabase
      .from("seo_keywords")
      .select("id, keyword")
      .eq("domain_id", domain_id)
      .eq("active", true);

    const keywordMap = new Map((keywords || []).map((k: any) => [k.keyword.toLowerCase(), k.id]));

    // Process rows: match to tracked keywords and upsert rank history
    let upserted = 0;
    const newKeywords: string[] = [];

    for (const row of rows) {
      const query = row.keys[0]?.toLowerCase();
      const page = row.keys[1];
      const date = row.keys[2];

      let keywordId = keywordMap.get(query);

      // Auto-create keyword if not tracked yet (first 200 new ones)
      if (!keywordId && newKeywords.length < 200 && !newKeywords.includes(query)) {
        const { data: newKw } = await supabase
          .from("seo_keywords")
          .insert({
            domain_id,
            keyword: query,
            target_url: page,
            company_id: domain.company_id,
            tags: ["auto-imported"],
          })
          .select("id")
          .single();
        if (newKw) {
          keywordId = newKw.id;
          keywordMap.set(query, keywordId);
          newKeywords.push(query);
        }
      }

      if (!keywordId) continue;

      await supabase.from("seo_rank_history").upsert(
        {
          keyword_id: keywordId,
          date,
          position: row.position,
          url_found: page,
          source: "gsc",
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          ctr: row.ctr || 0,
          company_id: domain.company_id,
        },
        { onConflict: "keyword_id,date,source" }
      );
      upserted++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        rows_processed: rows.length,
        rank_entries_upserted: upserted,
        new_keywords_created: newKeywords.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("seo-gsc-sync error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
