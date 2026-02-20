import { requireAuth, json, corsHeaders } from "../_shared/auth.ts";
import { callAIStream, AIError } from "../_shared/aiRouter.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication
    const { userId, serviceClient } = await requireAuth(req);

    const { domain_id, messages } = await req.json();

    if (!domain_id || !messages?.length) {
      return json({ error: "domain_id and messages required" }, 400);
    }

    // Get the user's company_id
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.company_id) {
      return json({ error: "User profile not found" }, 403);
    }

    // Fetch domain and verify it belongs to the user's company
    const { data: domain } = await serviceClient
      .from("seo_domains")
      .select("*")
      .eq("id", domain_id)
      .eq("company_id", profile.company_id)
      .single();

    if (!domain) {
      return json({ error: "Domain not found or access denied" }, 404);
    }

    // Fetch context data for the AI
    const [keywordsRes, pagesRes, insightsRes, tasksRes] = await Promise.all([
      serviceClient
        .from("seo_keyword_ai")
        .select("keyword, intent, impressions_28d, clicks_28d, ctr, avg_position, trend_score, opportunity_score, status, topic_cluster")
        .eq("domain_id", domain_id)
        .order("opportunity_score", { ascending: false })
        .limit(50),
      serviceClient
        .from("seo_page_ai")
        .select("url, impressions, clicks, ctr, avg_position, sessions, engagement_rate, conversions, revenue, seo_score, cwv_status")
        .eq("domain_id", domain_id)
        .order("seo_score", { ascending: false })
        .limit(30),
      serviceClient
        .from("seo_insight")
        .select("entity_type, insight_type, explanation_text, confidence_score")
        .eq("domain_id", domain_id)
        .order("confidence_score", { ascending: false })
        .limit(20),
      serviceClient
        .from("seo_tasks")
        .select("title, priority, status, task_type, expected_impact, created_by")
        .eq("domain_id", domain_id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    const contextData = `
DOMAIN: ${domain.domain}

TOP KEYWORDS (by opportunity score):
${JSON.stringify(keywordsRes.data || [], null, 1)}

TOP PAGES (by SEO score):
${JSON.stringify(pagesRes.data || [], null, 1)}

LATEST AI INSIGHTS:
${JSON.stringify(insightsRes.data || [], null, 1)}

OPEN TASKS:
${JSON.stringify(tasksRes.data || [], null, 1)}
`;

    const systemPrompt = `You are the SEO Copilot for the Rebar ERP system, analyzing ${domain.domain}.

You ONLY answer based on the SEO data provided below. Never fabricate metrics.
Reference specific numbers, keywords, pages, and trends in your answers.
Be concise and action-oriented. Use markdown formatting.

If asked about something not in the data, say "I don't have that data yet — run an AI analysis first."

CURRENT SEO DATA:
${contextData}`;

    // Stream from Gemini (large context SEO data)
    const aiResponse = await callAIStream({
      provider: "gemini",
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    // Return the thrown Response directly (from requireAuth)
    if (e instanceof Response) return e;

    console.error("seo-ai-copilot error:", e);

    if (e instanceof AIError) {
      return json({ error: "AI service error" }, e.status);
    }
    return json({ error: "Internal server error" }, 500);
  }
});
