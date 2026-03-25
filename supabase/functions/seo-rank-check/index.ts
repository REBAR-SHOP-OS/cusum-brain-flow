import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body, serviceClient }) => {
    const dfLogin = Deno.env.get("DATAFORSEO_LOGIN");
    const dfPassword = Deno.env.get("DATAFORSEO_PASSWORD");

    if (!dfLogin || !dfPassword) {
      return {
        error: "DataForSEO not configured. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD secrets.",
        fallback: "Module will use GSC average position data instead.",
      };
    }

    const { domain_id, keyword_ids } = body;
    if (!domain_id) {
      return new Response(JSON.stringify({ error: "domain_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = serviceClient
      .from("seo_keywords")
      .select("*")
      .eq("domain_id", domain_id)
      .eq("active", true);

    if (keyword_ids?.length) {
      query = query.in("id", keyword_ids);
    }

    const { data: keywords } = await query.limit(2000);
    if (!keywords?.length) return { success: true, checked: 0 };

    const { data: domain } = await serviceClient
      .from("seo_domains")
      .select("company_id, domain")
      .eq("id", domain_id)
      .single();
    if (!domain) throw new Error("Domain not found");

    const today = new Date().toISOString().split("T")[0];
    let checked = 0;

    const tasks = keywords.map((kw: any) => ({
      keyword: kw.keyword,
      location_code: kw.country === "AU" ? 2036 : kw.country === "US" ? 2840 : 2036,
      language_code: "en",
      device: kw.device === "mobile" ? "mobile" : "desktop",
      depth: 30,
      tag: kw.id,
    }));

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
      throw new Error(`DataForSEO API error: ${dfResponse.status}`);
    }

    const dfData = await dfResponse.json();

    for (const task of dfData.tasks || []) {
      if (task.status_code !== 20000) continue;
      const keywordId = task.data?.tag;
      if (!keywordId) continue;

      const items = task.result?.[0]?.items || [];
      const ourResult = items.find(
        (item: any) => item.type === "organic" && item.domain?.includes(domain.domain)
      );

      await serviceClient.from("seo_rank_history").upsert(
        {
          keyword_id: keywordId, date: today,
          position: ourResult?.rank_absolute || null,
          url_found: ourResult?.url || null,
          source: "serp", company_id: domain.company_id,
        },
        { onConflict: "keyword_id,date,source" }
      );
      checked++;
    }

    return { success: true, checked, total_keywords: keywords.length };
  }, { functionName: "seo-rank-check", authMode: "none", requireCompany: false, wrapResult: false })
);
