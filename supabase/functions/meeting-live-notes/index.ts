import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId, transcript, previousNotes } = await req.json();
    if (!meetingId || !transcript) {
      throw new Error("meetingId and transcript are required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a live meeting note-taker for a manufacturing company. Analyze the transcript and produce structured notes in JSON (no markdown fences):
{
  "keyPoints": ["Array of key discussion points so far"],
  "decisions": ["Array of decisions made"],
  "actionItems": [{"task": "description", "assignee": "name or null", "priority": "low|medium|high"}],
  "questions": ["Open questions or items needing clarification"],
  "risks": ["Risks or blockers mentioned"]
}

${previousNotes ? `Previous notes from earlier in this meeting (build on these, don't repeat):\n${JSON.stringify(previousNotes)}` : "This is the first analysis of this meeting."}

Be concise. Focus on actionable items. If you can identify who said what, attribute it.`,
            },
            {
              role: "user",
              content: `Live meeting transcript:\n\n${transcript}`,
            },
          ],
          temperature: 0.3,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI gateway error: ${aiResponse.status} - ${errText}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        keyPoints: [rawContent.slice(0, 200)],
        decisions: [],
        actionItems: [],
        questions: [],
        risks: [],
      };
    }

    return new Response(JSON.stringify({ success: true, notes: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Meeting live notes error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
