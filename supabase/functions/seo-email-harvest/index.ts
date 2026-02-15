import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEO_TOOL_SENDERS = [
  "%semrush%",
  "%wincher%",
  "%yoast%",
  "%ahrefs%",
  "%moz.com%",
  "%searchconsole%",
];

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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

    const { data: domain } = await supabase
      .from("seo_domains")
      .select("*")
      .eq("id", domain_id)
      .single();
    if (!domain) {
      return new Response(JSON.stringify({ error: "Domain not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = domain.company_id;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    // Query SEO tool emails with full body
    const { data: emails, error: emailErr } = await supabase
      .from("communications")
      .select("id, from_address, subject, body_preview, metadata, received_at")
      .eq("company_id", companyId)
      .eq("source", "gmail")
      .gte("received_at", cutoff.toISOString())
      .or(SEO_TOOL_SENDERS.map((s) => `from_address.ilike.${s}`).join(","))
      .order("received_at", { ascending: false })
      .limit(30);

    if (emailErr) {
      console.error("Email query error:", emailErr);
      throw new Error("Failed to query SEO emails");
    }

    if (!emails || emails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, emails_found: 0, keywords_extracted: 0, message: "No SEO tool emails found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract content from each email
    const emailBlocks: string[] = [];
    for (const em of emails) {
      const meta = em.metadata as Record<string, unknown> | null;
      const rawBody = (meta?.body as string) || em.body_preview || "";
      const cleanText = stripHtml(rawBody).slice(0, 4000); // Cap per email
      if (cleanText.length < 50) continue;

      const sender = (em.from_address || "").toLowerCase();
      let toolName = "unknown";
      if (sender.includes("semrush")) toolName = "semrush";
      else if (sender.includes("wincher")) toolName = "wincher";
      else if (sender.includes("yoast")) toolName = "yoast";
      else if (sender.includes("ahrefs")) toolName = "ahrefs";
      else if (sender.includes("moz")) toolName = "moz";
      else if (sender.includes("searchconsole")) toolName = "gsc";

      emailBlocks.push(
        `[${toolName.toUpperCase()} — ${em.subject || "No Subject"} — ${em.received_at}]\n${cleanText}`
      );
    }

    if (emailBlocks.length === 0) {
      return new Response(
        JSON.stringify({ success: true, emails_found: emails.length, keywords_extracted: 0, message: "No parseable content in SEO emails" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${emailBlocks.length} SEO tool emails for domain ${domain.domain}`);

    // Get existing keywords for dedup
    const { data: existingKw } = await supabase
      .from("seo_keyword_ai")
      .select("keyword, sources")
      .eq("domain_id", domain_id)
      .limit(200);
    const existingKeywords = new Map(
      (existingKw || []).map((k: any) => [k.keyword.toLowerCase(), k.sources || []])
    );

    // AI extraction
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
            content: `You are an SEO data extraction specialist. Parse SEO tool report emails (from Semrush, Wincher, Yoast, Ahrefs, Moz) and extract structured keyword ranking data and SEO issues. Focus on:
- Keyword + position pairs (current ranking position)
- Position changes (gained/lost positions)
- SEO site issues (broken links, missing meta, redirects, crawl errors)
- Domain: ${domain.domain}
Extract CONCRETE data points, not general observations.`,
          },
          {
            role: "user",
            content: `Extract SEO keywords with rankings and site issues from these tool report emails:\n\n${emailBlocks.join("\n\n---\n\n")}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_seo_data",
              description: "Return extracted keywords and SEO issues from tool report emails",
              parameters: {
                type: "object",
                properties: {
                  keywords: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        keyword: { type: "string", description: "Keyword phrase" },
                        position: { type: "number", description: "Current ranking position (1-100+)" },
                        position_change: { type: "number", description: "Position change (positive = improved)" },
                        tool_source: { type: "string", description: "semrush, wincher, yoast, ahrefs, moz" },
                        intent: { type: "string", enum: ["informational", "navigational", "transactional", "commercial"] },
                        business_relevance: { type: "number", description: "0-100" },
                        sample_context: { type: "string", description: "Context from the report" },
                      },
                      required: ["keyword", "tool_source"],
                    },
                  },
                  issues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        issue_type: { type: "string", description: "broken_link, missing_meta, redirect, crawl_error, etc." },
                        severity: { type: "string", enum: ["critical", "warning", "info"] },
                        page_url: { type: "string", description: "Affected page URL if available" },
                        description: { type: "string", description: "Issue description" },
                        tool_source: { type: "string" },
                      },
                      required: ["issue_type", "description", "tool_source"],
                    },
                  },
                },
                required: ["keywords", "issues"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_seo_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      const status = aiResponse.status === 429 ? 429 : aiResponse.status === 402 ? 402 : 500;
      const msg = status === 429 ? "Rate limit exceeded" : status === 402 ? "AI credits exhausted" : "AI extraction failed";
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI returned no structured data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    const now = new Date().toISOString();
    let kwUpserted = 0;
    let issuesCreated = 0;

    // Upsert keywords
    for (const kw of extracted.keywords || []) {
      const kwLower = (kw.keyword || "").toLowerCase().trim();
      if (!kwLower || kwLower.length < 3) continue;

      const existingSources = existingKeywords.get(kwLower) || [];
      const mergedSources = Array.from(new Set([...existingSources, "seo_tools", kw.tool_source]));

      const { error } = await supabase.from("seo_keyword_ai").upsert(
        {
          domain_id,
          keyword: kwLower,
          sources: mergedSources,
          source_count: mergedSources.length,
          business_relevance: Math.min(100, Math.max(0, kw.business_relevance || 50)),
          sample_context: (kw.sample_context || `From ${kw.tool_source} report`).slice(0, 500),
          harvested_at: now,
          intent: kw.intent || "commercial",
          opportunity_score: kw.position ? Math.max(0, 100 - (kw.position || 50)) : 50,
          status: "opportunity",
          company_id: companyId,
        },
        { onConflict: "domain_id,keyword", ignoreDuplicates: false }
      );
      if (!error) kwUpserted++;
      else console.error("Keyword upsert error:", error.message, kwLower);
    }

    // Insert SEO issues as insights
    for (const issue of extracted.issues || []) {
      const { error } = await supabase.from("seo_insight").insert({
        domain_id,
        entity_type: "page",
        entity_id: issue.page_url || domain.domain,
        insight_type: issue.severity === "critical" ? "risk" : "action",
        explanation_text: `[${issue.tool_source}] ${issue.description}`,
        confidence_score: issue.severity === "critical" ? 0.9 : issue.severity === "warning" ? 0.7 : 0.5,
        recommended_action: `Fix ${issue.issue_type}: ${issue.description}`,
      });
      if (!error) issuesCreated++;
      else console.error("Insight insert error:", error.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        emails_found: emails.length,
        emails_parsed: emailBlocks.length,
        keywords_extracted: kwUpserted,
        issues_found: issuesCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("seo-email-harvest error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
