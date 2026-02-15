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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceKey);
    const { domain_id } = await req.json();
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

    // Get Google OAuth tokens
    const { data: tokenRow } = await supabase
      .from("integration_tokens")
      .select("*")
      .eq("provider", "google")
      .eq("company_id", domain.company_id)
      .maybeSingle();

    if (!tokenRow?.access_token) {
      return new Response(
        JSON.stringify({ error: "Google OAuth not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- STEP 1: Pull GSC data (28 days) ----
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 28);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const siteUrl = `sc-domain:${domain.domain}`;

    // GSC queries
    const gscQueriesRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenRow.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ["query"],
          rowLimit: 1000,
        }),
      }
    );

    // GSC pages
    const gscPagesRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenRow.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ["page"],
          rowLimit: 500,
        }),
      }
    );

    let gscKeywords: any[] = [];
    let gscPages: any[] = [];

    if (gscQueriesRes.ok) {
      const d = await gscQueriesRes.json();
      gscKeywords = (d.rows || []).map((r: any) => ({
        keyword: r.keys[0],
        impressions: r.impressions,
        clicks: r.clicks,
        ctr: r.ctr,
        position: r.position,
      }));
    }

    if (gscPagesRes.ok) {
      const d = await gscPagesRes.json();
      gscPages = (d.rows || []).map((r: any) => ({
        url: r.keys[0],
        impressions: r.impressions,
        clicks: r.clicks,
        ctr: r.ctr,
        position: r.position,
      }));
    }

    console.log(`GSC: ${gscKeywords.length} keywords, ${gscPages.length} pages`);

    // ---- STEP 2: Pull GA4 data (if configured) ----
    let gaPages: any[] = [];
    if (domain.verified_ga && domain.ga_property_id) {
      try {
        const gaRes = await fetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${domain.ga_property_id}:runReport`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenRow.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
              dimensions: [{ name: "pagePath" }],
              metrics: [
                { name: "sessions" },
                { name: "engagementRate" },
                { name: "conversions" },
                { name: "totalRevenue" },
              ],
              limit: 500,
              dimensionFilter: {
                filter: {
                  fieldName: "sessionDefaultChannelGroup",
                  stringFilter: { value: "Organic Search", matchType: "EXACT" },
                },
              },
            }),
          }
        );
        if (gaRes.ok) {
          const gaData = await gaRes.json();
          gaPages = (gaData.rows || []).map((r: any) => ({
            path: r.dimensionValues?.[0]?.value || "",
            sessions: parseInt(r.metricValues?.[0]?.value || "0"),
            engagementRate: parseFloat(r.metricValues?.[1]?.value || "0"),
            conversions: parseInt(r.metricValues?.[2]?.value || "0"),
            revenue: parseFloat(r.metricValues?.[3]?.value || "0"),
          }));
        }
      } catch (e) {
        console.error("GA4 fetch error:", e);
      }
    }

    // ---- STEP 3: Upsert raw data into AI tables ----
    // Keywords
    for (const kw of gscKeywords) {
      await supabase.from("seo_keyword_ai").upsert(
        {
          domain_id,
          keyword: kw.keyword,
          impressions_28d: kw.impressions,
          clicks_28d: kw.clicks,
          ctr: kw.ctr,
          avg_position: kw.position,
          top_page: null,
          company_id: domain.company_id,
        },
        { onConflict: "domain_id,keyword" }
      );
    }

    // Pages — merge GSC + GA
    const gaMap = new Map(gaPages.map((g: any) => [g.path, g]));
    for (const pg of gscPages) {
      const urlPath = new URL(pg.url).pathname;
      const ga = gaMap.get(urlPath);
      await supabase.from("seo_page_ai").upsert(
        {
          domain_id,
          url: pg.url,
          impressions: pg.impressions,
          clicks: pg.clicks,
          ctr: pg.ctr,
          avg_position: pg.position,
          sessions: ga?.sessions || 0,
          engagement_rate: ga?.engagementRate || 0,
          conversions: ga?.conversions || 0,
          revenue: ga?.revenue || 0,
          company_id: domain.company_id,
        },
        { onConflict: "domain_id,url" }
      );
    }

    // ---- STEP 4: AI Analysis ----
    const topKeywords = gscKeywords.slice(0, 100);
    const topPages = gscPages.slice(0, 50);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an SEO analyst for ${domain.domain}. Analyze the GSC + GA data and produce structured insights. Be specific with numbers and actionable recommendations.`,
          },
          {
            role: "user",
            content: `Analyze this SEO data for ${domain.domain}:

TOP KEYWORDS (28d):
${JSON.stringify(topKeywords, null, 1)}

TOP PAGES (28d):
${JSON.stringify(topPages, null, 1)}

GA PAGE DATA:
${JSON.stringify(gaPages.slice(0, 30), null, 1)}

For each keyword, classify intent and score opportunity (0-100).
For each page, score SEO health (0-100).
Identify top insights: opportunities, risks, wins.
Suggest specific tasks with expected impact.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "seo_analysis_results",
              description: "Return structured SEO analysis results",
              parameters: {
                type: "object",
                properties: {
                  keyword_analysis: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        keyword: { type: "string" },
                        intent: { type: "string", enum: ["informational", "navigational", "transactional", "commercial"] },
                        topic_cluster: { type: "string" },
                        trend_score: { type: "number" },
                        opportunity_score: { type: "number" },
                        status: { type: "string", enum: ["winner", "stagnant", "declining", "opportunity"] },
                      },
                      required: ["keyword", "intent", "opportunity_score", "status"],
                    },
                  },
                  page_analysis: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        url: { type: "string" },
                        seo_score: { type: "number" },
                        recommendations: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              type: { type: "string" },
                              suggestion: { type: "string" },
                            },
                            required: ["type", "suggestion"],
                          },
                        },
                      },
                      required: ["url", "seo_score"],
                    },
                  },
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        entity_type: { type: "string", enum: ["keyword", "page"] },
                        entity_ref: { type: "string" },
                        insight_type: { type: "string", enum: ["opportunity", "risk", "win", "action"] },
                        explanation: { type: "string" },
                        confidence: { type: "number" },
                      },
                      required: ["entity_type", "insight_type", "explanation", "confidence"],
                    },
                  },
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        task_type: { type: "string", enum: ["content", "technical", "internal_link"] },
                        priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        expected_impact: { type: "string" },
                        entity_url: { type: "string" },
                      },
                      required: ["title", "task_type", "priority"],
                    },
                  },
                },
                required: ["keyword_analysis", "page_analysis", "insights", "tasks"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "seo_analysis_results" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response");
      return new Response(JSON.stringify({ error: "AI returned no structured data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    // ---- STEP 5: Write AI results back ----
    let kwUpdated = 0, pgUpdated = 0, insightsCreated = 0, tasksCreated = 0;

    // Update keywords with AI enrichment
    for (const kw of analysis.keyword_analysis || []) {
      const { error } = await supabase
        .from("seo_keyword_ai")
        .update({
          intent: kw.intent,
          topic_cluster: kw.topic_cluster || null,
          trend_score: kw.trend_score || 0,
          opportunity_score: kw.opportunity_score,
          status: kw.status,
          last_analyzed_at: new Date().toISOString(),
        })
        .eq("domain_id", domain_id)
        .eq("keyword", kw.keyword);
      if (!error) kwUpdated++;
    }

    // Update pages with AI enrichment
    for (const pg of analysis.page_analysis || []) {
      const { error } = await supabase
        .from("seo_page_ai")
        .update({
          seo_score: pg.seo_score,
          ai_recommendations: pg.recommendations || [],
          last_analyzed_at: new Date().toISOString(),
        })
        .eq("domain_id", domain_id)
        .eq("url", pg.url);
      if (!error) pgUpdated++;
    }

    // Clear old insights and write new ones
    await supabase.from("seo_insight").delete().eq("domain_id", domain_id);

    for (const ins of analysis.insights || []) {
      const { error } = await supabase.from("seo_insight").insert({
        domain_id,
        entity_type: ins.entity_type,
        insight_type: ins.insight_type,
        explanation_text: ins.explanation,
        confidence_score: Math.min(1, Math.max(0, ins.confidence)),
        ai_payload_json: ins,
        company_id: domain.company_id,
      });
      if (!error) insightsCreated++;
    }

    // Create AI tasks
    for (const task of analysis.tasks || []) {
      const { error } = await supabase.from("seo_tasks").insert({
        domain_id,
        title: task.title,
        description: task.description || null,
        priority: task.priority,
        status: "open",
        task_type: task.task_type,
        expected_impact: task.expected_impact || null,
        entity_url: task.entity_url || null,
        created_by: "ai",
        ai_reasoning: task.description || task.title,
        company_id: domain.company_id,
      });
      if (!error) tasksCreated++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        gsc_keywords: gscKeywords.length,
        gsc_pages: gscPages.length,
        ga_pages: gaPages.length,
        ai_keywords_updated: kwUpdated,
        ai_pages_updated: pgUpdated,
        insights_created: insightsCreated,
        tasks_created: tasksCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("seo-ai-analyze error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
