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
    const { meetingId } = await req.json();
    if (!meetingId) throw new Error("meetingId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch the meeting
    const { data: meeting, error: meetingErr } = await supabase
      .from("team_meetings")
      .select("*")
      .eq("id", meetingId)
      .single();

    if (meetingErr || !meeting) throw new Error("Meeting not found");

    // Fetch channel messages during the meeting period
    const startedAt = meeting.started_at;
    const endedAt = meeting.ended_at || new Date().toISOString();

    const { data: messages } = await supabase
      .from("team_messages")
      .select("original_text, sender_profile_id, created_at")
      .eq("channel_id", meeting.channel_id)
      .gte("created_at", startedAt)
      .lte("created_at", endedAt)
      .order("created_at", { ascending: true })
      .limit(200);

    // Fetch participant profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .limit(100);

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.id, p.full_name])
    );

    // Build context for AI
    const durationMs =
      new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const durationMin = Math.round(durationMs / 60000);

    const chatLog =
      messages && messages.length > 0
        ? messages
            .map(
              (m: any) =>
                `[${profileMap.get(m.sender_profile_id) || "Unknown"}]: ${m.original_text}`
            )
            .join("\n")
        : "No chat messages during this meeting.";

    const meetingContext = `
Meeting: ${meeting.title}
Type: ${meeting.meeting_type}
Duration: ${durationMin} minutes
Started: ${startedAt}
Ended: ${endedAt}

Chat log during meeting:
${chatLog}
`;

    // Call Lovable AI for summarization
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
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are an AI meeting assistant for a steel/rebar manufacturing company.
Analyze the meeting data and generate a structured summary in JSON format (no markdown fences):
{
  "summary": "2-3 sentence overview of what was discussed",
  "keyPoints": ["Array of key discussion points"],
  "actionItems": ["Array of action items with assigned person if identifiable"],
  "decisions": ["Array of decisions made"],
  "followUps": ["Array of items needing follow-up"]
}

Keep it concise and actionable. Focus on business-relevant takeaways.
If the chat log is empty, infer from the meeting title and type.`,
            },
            {
              role: "user",
              content: `Summarize this meeting:\n\n${meetingContext}`,
            },
          ],
          temperature: 0.5,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const cleaned = rawContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      parsed = {
        summary: rawContent.slice(0, 500),
        keyPoints: [],
        actionItems: [],
        decisions: [],
        followUps: [],
      };
    }

    // Build notes text
    const notesText = [
      `## Meeting Summary\n${parsed.summary}`,
      parsed.keyPoints?.length
        ? `\n## Key Points\n${parsed.keyPoints.map((p: string) => `- ${p}`).join("\n")}`
        : "",
      parsed.actionItems?.length
        ? `\n## Action Items\n${parsed.actionItems.map((a: string) => `- [ ] ${a}`).join("\n")}`
        : "",
      parsed.decisions?.length
        ? `\n## Decisions\n${parsed.decisions.map((d: string) => `- ${d}`).join("\n")}`
        : "",
      parsed.followUps?.length
        ? `\n## Follow-ups\n${parsed.followUps.map((f: string) => `- ${f}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    // Update meeting with AI summary
    const participantNames = [
      ...new Set((messages || []).map((m: any) => profileMap.get(m.sender_profile_id)).filter(Boolean)),
    ];

    await supabase
      .from("team_meetings")
      .update({
        notes: notesText,
        ai_summary: parsed.summary,
        participants: participantNames,
        duration_seconds: Math.round(durationMs / 1000),
      })
      .eq("id", meetingId);

    // Save to Brain (knowledge table)
    const { error: brainErr } = await supabase.from("knowledge").insert({
      title: `Meeting Notes: ${meeting.title}`,
      category: "meetings",
      content: notesText,
      metadata: {
        meeting_id: meetingId,
        meeting_type: meeting.meeting_type,
        channel_id: meeting.channel_id,
        duration_minutes: durationMin,
        participants: participantNames,
        action_items: parsed.actionItems || [],
        decisions: parsed.decisions || [],
        started_at: startedAt,
        ended_at: endedAt,
      },
    });

    if (brainErr) {
      console.error("Failed to save to Brain:", brainErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: parsed.summary,
        notes: notesText,
        participants: participantNames,
        duration_minutes: durationMin,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Summarize meeting error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
