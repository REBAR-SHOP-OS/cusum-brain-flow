import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, AIError } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RawSnippet {
  source: string;
  text: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
    const cutoffStr = cutoff.toISOString();
    const snippets: RawSnippet[] = [];

    // ---- SOURCE 1: Social Media Posts ----
    try {
      const { data: posts } = await supabase
        .from("social_posts")
        .select("content, title, hashtags")
        .eq("company_id", companyId)
        .gte("created_at", cutoffStr)
        .limit(50);
      for (const p of posts || []) {
        const parts = [p.title, p.content, ...(p.hashtags || [])].filter(Boolean);
        if (parts.length) snippets.push({ source: "social", text: parts.join(" ").slice(0, 300) });
      }
    } catch (e) { console.log("social_posts skip:", e); }

    // ---- SOURCE 2: Communications (Customer Emails) ----
    try {
      const { data: comms } = await supabase
        .from("communications")
        .select("subject, body_preview, ai_category")
        .eq("company_id", companyId)
        .gte("created_at", cutoffStr)
        .not("subject", "is", null)
        .limit(50);
      for (const c of comms || []) {
        const parts = [c.subject, c.body_preview, c.ai_category].filter(Boolean);
        if (parts.length) snippets.push({ source: "email", text: parts.join(" ").slice(0, 300) });
      }
    } catch (e) { console.log("communications skip:", e); }

    // ---- SOURCE 3: Leads ----
    try {
      const { data: leads } = await supabase
        .from("leads")
        .select("title, description, source")
        .eq("company_id", companyId)
        .gte("created_at", cutoffStr)
        .limit(50);
      for (const l of leads || []) {
        const parts = [l.title, l.description, l.source].filter(Boolean);
        if (parts.length) snippets.push({ source: "leads", text: parts.join(" ").slice(0, 300) });
      }
    } catch (e) { console.log("leads skip:", e); }

    // ---- SOURCE 4: Quote Requests ----
    try {
      const { data: quotes } = await supabase
        .from("quote_requests")
        .select("project_name, items, notes")
        .eq("company_id", companyId)
        .gte("created_at", cutoffStr)
        .limit(50);
      for (const q of quotes || []) {
        const itemStr = typeof q.items === "object" ? JSON.stringify(q.items) : String(q.items || "");
        const parts = [q.project_name, itemStr, q.notes].filter(Boolean);
        if (parts.length) snippets.push({ source: "quotes", text: parts.join(" ").slice(0, 300) });
      }
    } catch (e) { console.log("quote_requests skip:", e); }

    // ---- SOURCE 5: Orders + Order Items ----
    try {
      const { data: orders } = await supabase
        .from("orders")
        .select("project_name, notes")
        .eq("company_id", companyId)
        .gte("created_at", cutoffStr)
        .limit(30);
      for (const o of orders || []) {
        const parts = [o.project_name, o.notes].filter(Boolean);
        if (parts.length) snippets.push({ source: "orders", text: parts.join(" ").slice(0, 300) });
      }

      const { data: items } = await supabase
        .from("order_items")
        .select("description, notes")
        .gte("created_at", cutoffStr)
        .limit(30);
      for (const i of items || []) {
        const parts = [i.description, i.notes].filter(Boolean);
        if (parts.length) snippets.push({ source: "orders", text: parts.join(" ").slice(0, 200) });
      }
    } catch (e) { console.log("orders skip:", e); }

    // ---- SOURCE 6: Knowledge Base ----
    try {
      const { data: kb } = await supabase
        .from("knowledge")
        .select("title, content, category")
        .eq("company_id", companyId)
        .limit(30);
      for (const k of kb || []) {
        const parts = [k.title, k.category, (k.content || "").slice(0, 200)].filter(Boolean);
        if (parts.length) snippets.push({ source: "knowledge", text: parts.join(" ").slice(0, 300) });
      }
    } catch (e) { console.log("knowledge skip:", e); }

    // ---- SOURCE 7: WordPress Changes ----
    try {
      const { data: wp } = await supabase
        .from("wp_change_log")
        .select("entity_type, details")
        .eq("company_id", companyId)
        .gte("created_at", cutoffStr)
        .limit(30);
      for (const w of wp || []) {
        const detailStr = typeof w.details === "object" ? JSON.stringify(w.details) : String(w.details || "");
        const parts = [w.entity_type, detailStr].filter(Boolean);
        if (parts.length) snippets.push({ source: "wordpress", text: parts.join(" ").slice(0, 300) });
      }
    } catch (e) { console.log("wp_change_log skip:", e); }

    // ---- SOURCE 8: Prospects ----
    try {
      const { data: prospects } = await supabase
        .from("prospects")
        .select("company_name, industry, notes")
        .eq("company_id", companyId)
        .gte("created_at", cutoffStr)
        .limit(30);
      for (const p of prospects || []) {
        const parts = [p.company_name, p.industry, p.notes].filter(Boolean);
        if (parts.length) snippets.push({ source: "prospects", text: parts.join(" ").slice(0, 300) });
      }
    } catch (e) { console.log("prospects skip:", e); }

    // ---- SOURCE 9: SEO Tool Report Emails (Semrush, Wincher, Yoast, Ahrefs) ----
    try {
      const seoToolSenders = ["%semrush%", "%wincher%", "%yoast%", "%ahrefs%", "%moz.com%", "%searchconsole%"];
      const { data: seoEmails } = await supabase
        .from("communications")
        .select("from_address, subject, body_preview, metadata")
        .eq("company_id", companyId)
        .eq("source", "gmail")
        .gte("received_at", cutoffStr)
        .or(seoToolSenders.map((s) => `from_address.ilike.${s}`).join(","))
        .limit(20);
      for (const em of seoEmails || []) {
        const meta = em.metadata as Record<string, unknown> | null;
        const rawBody = (meta?.body as string) || em.body_preview || "";
        // Strip HTML for clean text
        const cleanText = rawBody
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 2000);
        if (cleanText.length > 50) {
          snippets.push({ source: "seo_tools", text: `${em.subject || ""} ${cleanText}`.slice(0, 500) });
        }
      }
    } catch (e) { console.log("seo_tool_emails skip:", e); }

    // ---- SOURCE 10: Existing GSC keywords (already in seo_keyword_ai) ----
    const { data: existingKw } = await supabase
      .from("seo_keyword_ai")
      .select("keyword, sources")
      .eq("domain_id", domain_id)
      .limit(200);
    const existingKeywords = new Map((existingKw || []).map((k: any) => [k.keyword.toLowerCase(), k.sources || []]));

    console.log(`Harvested ${snippets.length} raw snippets from ${new Set(snippets.map(s => s.source)).size} sources`);

    if (snippets.length === 0) {
      return new Response(JSON.stringify({ success: true, keywords_harvested: 0, message: "No data found in ERP sources" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- AI: Extract & deduplicate keywords ----
    const groupedBySource: Record<string, string[]> = {};
    for (const s of snippets) {
      if (!groupedBySource[s.source]) groupedBySource[s.source] = [];
      groupedBySource[s.source].push(s.text);
    }

    const sourceBlocks = Object.entries(groupedBySource)
      .map(([src, texts]) => `[${src.toUpperCase()}]\n${texts.join("\n")}`)
      .join("\n\n");

    const existingKwList = Array.from(existingKeywords.keys()).slice(0, 100).join(", ");

    const aiResult = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an SEO keyword extraction specialist for a rebar/steel manufacturing company (${domain.domain}). Extract keyword phrases from internal business data. Focus on commercial and product-related terms that potential customers would search for. Normalize variations (e.g., "rebar cutting" and "cut rebar" → "rebar cutting"). Deduplicate across sources.`,
        },
        {
          role: "user",
          content: `Extract SEO keyword phrases from these internal ERP data sources. Each keyword should be 2-5 words, relevant to what customers might search for.

EXISTING GSC KEYWORDS (for reference, merge with these if overlap): ${existingKwList || "none yet"}

INTERNAL DATA SOURCES:
${sourceBlocks}

For each keyword:
- Tag which sources contributed to it
- Score business_relevance (0-100): how directly tied to revenue/products
- Classify search intent
- Provide a short sample_context showing where it was found
- Score opportunity (0-100): how likely this keyword can drive traffic`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "harvest_keywords",
            description: "Return extracted and deduplicated keywords from ERP sources",
            parameters: {
              type: "object",
              properties: {
                keywords: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      keyword: { type: "string", description: "Normalized keyword phrase (2-5 words)" },
                      sources: { type: "array", items: { type: "string" }, description: "Source names that contributed" },
                      intent: { type: "string", enum: ["informational", "navigational", "transactional", "commercial"] },
                      topic_cluster: { type: "string", description: "Topic group name" },
                      business_relevance: { type: "number", description: "0-100 business value score" },
                      opportunity_score: { type: "number", description: "0-100 SEO opportunity" },
                      sample_context: { type: "string", description: "Short snippet showing where keyword was found" },
                    },
                    required: ["keyword", "sources", "intent", "business_relevance", "opportunity_score"],
                  },
                },
              },
              required: ["keywords"],
            },
          },
        },
      ],
      toolChoice: { type: "function", function: { name: "harvest_keywords" } },
    });

    const toolCall = aiResult.toolCalls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI returned no structured data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const harvest = JSON.parse(toolCall.function.arguments);
    const now = new Date().toISOString();
    let upserted = 0;

    for (const kw of harvest.keywords || []) {
      const kwLower = kw.keyword.toLowerCase().trim();
      if (!kwLower || kwLower.length < 3) continue;

      // Merge sources with existing if keyword already exists
      const existingSources = existingKeywords.get(kwLower) || [];
      const mergedSources = Array.from(new Set([...existingSources, ...kw.sources]));
      // Always include 'gsc' if it was there before
      if (existingSources.includes("gsc") && !mergedSources.includes("gsc")) {
        mergedSources.push("gsc");
      }

      const { error } = await supabase.from("seo_keyword_ai").upsert(
        {
          domain_id,
          keyword: kwLower,
          sources: mergedSources,
          source_count: mergedSources.length,
          business_relevance: Math.min(100, Math.max(0, kw.business_relevance || 0)),
          sample_context: (kw.sample_context || "").slice(0, 500),
          harvested_at: now,
          intent: kw.intent || "informational",
          topic_cluster: kw.topic_cluster || null,
          opportunity_score: kw.opportunity_score || 0,
          status: "opportunity",
          company_id: companyId,
        },
        { onConflict: "domain_id,keyword", ignoreDuplicates: false }
      );
      if (!error) upserted++;
      else console.error("Upsert error:", error.message, kwLower);
    }

    // Also tag existing GSC keywords with 'gsc' source if not already tagged
    const { data: untagged } = await supabase
      .from("seo_keyword_ai")
      .select("id, sources")
      .eq("domain_id", domain_id)
      .or("sources.is.null,sources.eq.{}");
    for (const row of untagged || []) {
      await supabase.from("seo_keyword_ai").update({
        sources: ["gsc"],
        source_count: 1,
      }).eq("id", row.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        snippets_collected: snippets.length,
        sources_queried: Object.keys(groupedBySource).length,
        keywords_harvested: upserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("seo-keyword-harvest error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
