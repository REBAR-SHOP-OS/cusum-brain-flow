import { handleRequest } from "../_shared/requestHandler.ts";
import { buildFullVizzyContext } from "../_shared/vizzyFullContext.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    // Rate limit: 10 per 5 minutes
    const { data: allowed } = await ctx.serviceClient.rpc("check_rate_limit", {
      _user_id: ctx.userId,
      _function_name: "vizzy-daily-brief",
      _max_requests: 10,
      _window_seconds: 300,
    });
    if (allowed === false) {
      throw new Response(
        JSON.stringify({ error: "Rate limited. Try again in a few minutes." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const context = await buildFullVizzyContext(ctx.serviceClient, ctx.userId, {
      includeFinancials: true,
    });

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      agentName: "vizzy",
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

IMPORTANT: PRESERVE all customer names, employee names, dollar amounts, and invoice numbers from the data. The voice assistant needs these specific details to answer follow-up questions. Do NOT over-summarize — keep granular data points.

CRITICAL NUMBER PRESERVATION RULES:
- Keep the exact staff count from "TEAM (X staff)" — do NOT change it, round it, or estimate a different number.
- Keep ALL specific counts (staff count, lead count, customer count, invoice count) EXACTLY as they appear in the data.
- Keep the [FACTS] block at the top of the data VERBATIM in your output — copy it unchanged as the first line of your response.
- Never replace a specific number with an estimate or a range.

CLOSE with ONE strategic recommendation — the single most important thing the CEO should act on today, with reasoning.

Keep each finding to 1-2 sentences. Be direct, analytical, and actionable. Never pad with "everything looks fine" — only flag what matters.
Always respond in English for the daily briefing.`,
        },
        { role: "user", content: context },
      ],
    });

    return {
      briefing: result.content || "No briefing available.",
      rawContext: context,
      generated_at: new Date().toISOString(),
    };
  }, { functionName: "vizzy-daily-brief", requireCompany: false, wrapResult: false })
);
