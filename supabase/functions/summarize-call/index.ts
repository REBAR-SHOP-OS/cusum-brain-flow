import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Rate limit: 10 requests per 60 seconds per user
    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: allowed } = await svcClient.rpc("check_rate_limit", {
      _user_id: userId,
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

    const { transcript, fromNumber, toNumber } = await req.json();

    if (!transcript || transcript.trim().length < 10) {
      return new Response(
        JSON.stringify({ summary: "Call too short to summarize.", tasks: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a call summarization assistant for CUSUM, a rebar shop operations system.
You will receive a transcript of a phone call. Your job is to:
1. Write a concise summary (2-4 sentences) of the call
2. Extract actionable tasks from the conversation

Return a JSON object with this exact structure:
{
  "summary": "Brief summary of the call...",
  "tasks": [
    {
      "title": "Short task title",
      "description": "Brief description of what needs to be done",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Rules:
- Only include genuine action items, not observations
- Tasks should be specific and actionable
- If no tasks are needed, return an empty tasks array
- Priority: "high" for urgent/time-sensitive, "medium" for normal follow-ups, "low" for nice-to-have
- Return ONLY valid JSON, no markdown formatting`;

    const userMessage = `Call between ${fromNumber || "Unknown"} and ${toNumber || "Unknown"}:

${transcript}`;

    // Use Flash for call summaries — good structured extraction at low cost
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI Gateway error:", await aiResponse.text());
      throw new Error("AI service temporarily unavailable");
    }

    const aiData = await aiResponse.json();
    const rawReply = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from the AI response
    let parsed: { summary: string; tasks: Array<{ title: string; description: string; priority: string }> };
    try {
      // Strip markdown code fences if present
      const cleaned = rawReply.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: use the raw reply as summary
      parsed = { summary: rawReply, tasks: [] };
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Summarize call error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
