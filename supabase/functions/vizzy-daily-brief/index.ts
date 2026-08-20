import { handleRequest } from "../_shared/requestHandler.ts";
import { buildFullVizzyContext } from "../_shared/vizzyFullContext.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";
import { VIZZY_BRIEFING_ADDENDUM } from "../_shared/vizzyIdentity.ts";

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

    const { getWorkspaceTimezone } = await import("../_shared/getWorkspaceTimezone.ts");
    const tz = await getWorkspaceTimezone(ctx.serviceClient);
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "2-digit", hourCycle: "h23",
    }).format(new Date());
    const hour = parseInt(hourStr, 10);
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      agentName: "vizzy",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: VIZZY_BRIEFING_ADDENDUM.replace(
            "Start with the greeting",
            `Start with "${greeting}, boss."`
          ),
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
