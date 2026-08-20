import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { callAI } from "../_shared/aiRouter.ts";

serve((req) =>
  handleRequest(req, async (ctx) => {
    // Rate limit
    const { data: allowed } = await ctx.serviceClient.rpc("check_rate_limit", {
      _user_id: ctx.userId,
      _function_name: "summarize-call",
      _max_requests: 10,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { transcript, fromNumber, toNumber, callMode } = ctx.body;

    if (!transcript || transcript.trim().length < 10) {
      return new Response(
        JSON.stringify({ summary: "Call too short to summarize.", tasks: [], rfq_details: null, callback_requested: null, lead_info: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a call summarization assistant for CUSUM, a rebar shop operations system.
You will receive a transcript of a phone call. Your job is to:
1. Write a concise summary (2-4 sentences) of the call
2. Extract actionable tasks from the conversation
3. Detect if the caller requested a quote (RFQ)
4. Detect if the caller asked to speak with a specific team member
5. Capture lead/contact information mentioned

Return a JSON object with this exact structure:
{
  "summary": "Brief summary of the call...",
  "tasks": [
    {
      "title": "Short task title",
      "description": "Brief description of what needs to be done",
      "priority": "high" | "medium" | "low"
    }
  ],
  "rfq_details": null or {
    "bar_sizes": ["20M", "25M"],
    "quantities": "approximate tonnes or piece counts mentioned",
    "project_type": "commercial/residential/infrastructure",
    "bending_required": true/false,
    "timeline": "when they need it",
    "delivery_location": "if mentioned"
  },
  "callback_requested": null or "Name of person caller asked to speak with (e.g. Neel, Saurabh, Sattar)",
  "lead_info": null or {
    "name": "caller's name",
    "company": "caller's company",
    "phone": "callback number if mentioned",
    "project_description": "brief project description"
  }
}

Rules:
- Only include genuine action items, not observations
- Tasks should be specific and actionable
- If no tasks are needed, return an empty tasks array
- Priority: "high" for urgent/time-sensitive, "medium" for normal follow-ups, "low" for nice-to-have
- rfq_details: ONLY if caller explicitly asked for a quote or pricing for specific items
- callback_requested: ONLY if caller specifically asked to speak with someone by name
- lead_info: capture any identifying info the caller shared
- Return ONLY valid JSON, no markdown formatting`;

    const userMessage = `Call mode: ${callMode || "unknown"}
Call between ${fromNumber || "Unknown"} and ${toNumber || "Unknown"}:

${transcript}`;

    const result = await callAI({
      provider: "gpt",
      model: "gpt-4o-mini",
      agentName: "system",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      maxTokens: 800,
      temperature: 0.3,
    });

    const rawReply = result.content;

    let parsed: {
      summary: string;
      tasks: Array<{ title: string; description: string; priority: string }>;
      rfq_details?: any;
      callback_requested?: string | null;
      lead_info?: any;
    };
    try {
      const cleaned = rawReply.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { summary: rawReply, tasks: [], rfq_details: null, callback_requested: null, lead_info: null };
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }, { functionName: "summarize-call", requireCompany: false, rawResponse: true })
);
