import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFullVizzyContext } from "../_shared/vizzyFullContext.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 5 per 10 minutes
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: user.id,
      _function_name: "vizzy-daily-brief",
      _max_requests: 5,
      _window_seconds: 600,
    });
    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "Rate limited. Try again in a few minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const context = await buildFullVizzyContext(supabase, user.id, {
      includeFinancials: true,
    });

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    // Gemini chosen: large context input (full business snapshot) is its strength
    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are JARVIS — Executive Intelligence Briefing System for the CEO of Rebar.shop.
Generate an EXECUTIVE INTELLIGENCE BRIEF, not a summary. Analyze the live data below.

FORMAT: Start with "${greeting}, boss." then deliver findings RANKED BY SEVERITY (not by category).
Each finding must include:
- 🔴/🟡/🟢 Risk indicator
- What's happening (the fact)
- Why it matters (business impact)
- Recommended action (specific next step)

REQUIRED ANALYSIS AREAS (include only if noteworthy — skip if nothing to flag):
1. Revenue & Cash Flow: AR/AP trends, overdue concentration, cash flow risk signals
2. Production Risk: Bottlenecks, stalled items, idle machines during active queue
3. Delivery Health: On-time rate, delays, at-risk deliveries
4. High-Value Customer Changes: Payment behavior shifts, complaint patterns
5. Pipeline & Leads: Hot leads needing action, stalled opportunities
6. System Health: Automation failures, sync issues, anomalies
7. Team: Notable presence/absence, capacity concerns

CLOSE with ONE strategic recommendation — the single most important thing the CEO should act on today, with reasoning.

Keep each finding to 1-2 sentences. Be direct, analytical, and actionable. Never pad with "everything looks fine" — only flag what matters.
Always respond in English for the daily briefing.`,
        },
        {
          role: "user",
          content: context,
        },
      ],
    });

    const briefing = result.content || "No briefing available.";

    return new Response(
      JSON.stringify({ briefing, generated_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("vizzy-daily-brief error:", e);
    const status = e instanceof AIError ? e.status : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
