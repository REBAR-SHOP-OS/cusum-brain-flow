import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingId } = await req.json();
    if (!meetingId) throw new Error("meetingId is required");

    // Auth guard
    let rateLimitId: string;
    try {
      const auth = await requireAuth(req);
      rateLimitId = auth.userId;
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: rateLimitId,
      _function_name: "summarize-meeting",
      _max_requests: 5,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch meeting
    const { data: meeting, error: meetingErr } = await supabase
      .from("team_meetings")
      .select("*")
      .eq("id", meetingId)
      .single();
    if (meetingErr || !meeting) throw new Error("Meeting not found");

    // Fetch transcript entries (primary source)
    const { data: transcriptEntries } = await supabase
      .from("meeting_transcript_entries")
      .select("speaker_name, speaker_profile_id, text, timestamp_ms, language")
      .eq("meeting_id", meetingId)
      .eq("is_final", true)
      .order("timestamp_ms", { ascending: true })
      .limit(500);

    // Fetch chat messages as secondary source
    const startedAt = meeting.started_at;
    const endedAt = meeting.ended_at || new Date().toISOString();
    const { data: chatMessages } = await supabase
      .from("team_messages")
      .select("original_text, sender_profile_id, created_at")
      .eq("channel_id", meeting.channel_id)
      .gte("created_at", startedAt)
      .lte("created_at", endedAt)
      .order("created_at", { ascending: true })
      .limit(200);

    // Fetch profiles for name resolution
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .limit(200);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));

    // Build transcript text
    const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const durationMin = Math.round(durationMs / 60000);

    let transcriptText = "";
    if (transcriptEntries && transcriptEntries.length > 0) {
      transcriptText = transcriptEntries
        .map((e: any) => {
          const mins = Math.floor(e.timestamp_ms / 60000);
          const secs = Math.floor((e.timestamp_ms % 60000) / 1000);
          return `[${mins}:${String(secs).padStart(2, "0")}] ${e.speaker_name}: ${e.text}`;
        })
        .join("\n");
    }

    const chatLog = (chatMessages && chatMessages.length > 0)
      ? chatMessages
          .map((m: any) => `[Chat] ${profileMap.get(m.sender_profile_id) || "Unknown"}: ${m.original_text}`)
          .join("\n")
      : "";

    const fullContext = [transcriptText, chatLog].filter(Boolean).join("\n\n---\n\n");

    // Collect unique participant names
    const participantNames = [
      ...new Set([
        ...(transcriptEntries || []).map((e: any) => e.speaker_name),
        ...(chatMessages || []).map((m: any) => profileMap.get(m.sender_profile_id)).filter(Boolean),
      ]),
    ];

    // Calculate talk time per speaker
    const speakerWordCounts: Record<string, number> = {};
    for (const e of (transcriptEntries || [])) {
      const name = (e as any).speaker_name;
      const words = ((e as any).text || "").split(/\s+/).length;
      speakerWordCounts[name] = (speakerWordCounts[name] || 0) + words;
    }
    const totalWords = Object.values(speakerWordCounts).reduce((a, b) => a + b, 0);
    const participantContributions = Object.entries(speakerWordCounts).map(([name, words]) => ({
      name,
      talkPercent: totalWords > 0 ? Math.round((words / totalWords) * 100) : 0,
    }));

    const meetingContext = `
Meeting: ${meeting.title}
Type: ${meeting.meeting_type}
Duration: ${durationMin} minutes
Started: ${startedAt}
Ended: ${endedAt}
Participants: ${participantNames.join(", ") || "Unknown"}
Has recording: ${meeting.recording_url ? "Yes" : "No"}

${fullContext || "No transcript or chat data available."}
`;

    // AI summarization
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
Generate a comprehensive CEO meeting report in JSON (no markdown fences):
{
  "executiveSummary": "2-4 sentence high-level overview",
  "keyBullets": ["5-8 bullet points covering the meeting highlights"],
  "decisions": [{"decision": "what was decided", "context": "why/how", "owner": "who"}],
  "actionItems": [{"task": "specific task", "assignee": "person name", "dueDate": "YYYY-MM-DD or null", "priority": "low|medium|high", "confidence": 0.0-1.0}],
  "risks": ["risks or blockers identified"],
  "followUps": ["items needing follow-up"],
  "participantContributions": [{"name": "person", "role": "inferred role", "keyPoints": ["what they contributed"]}]
}

Rules:
- Keep it concise and CEO-friendly
- Mark confidence on each action item (1.0 = explicitly stated, 0.5 = inferred)
- If no clear data, be honest about what's missing
- Focus on business-relevant takeaways`,
            },
            {
              role: "user",
              content: `Generate the CEO report for this meeting:\n\n${meetingContext}`,
            },
          ],
          temperature: 0.4,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let parsed: any;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        executiveSummary: rawContent.slice(0, 500),
        keyBullets: [],
        decisions: [],
        actionItems: [],
        risks: [],
        followUps: [],
        participantContributions: [],
      };
    }

    // Build markdown notes
    const notesText = [
      `## Meeting Summary\n${parsed.executiveSummary}`,
      parsed.keyBullets?.length
        ? `\n## Key Points\n${parsed.keyBullets.map((p: string) => `- ${p}`).join("\n")}`
        : "",
      parsed.decisions?.length
        ? `\n## Decisions\n${parsed.decisions.map((d: any) => `- **${d.decision}** (${d.owner || "TBD"})`).join("\n")}`
        : "",
      parsed.actionItems?.length
        ? `\n## Action Items\n${parsed.actionItems.map((a: any) => `- [ ] ${a.task} → ${a.assignee || "TBD"} (${a.priority})`).join("\n")}`
        : "",
      parsed.risks?.length
        ? `\n## Risks\n${parsed.risks.map((r: string) => `- ⚠️ ${r}`).join("\n")}`
        : "",
      parsed.followUps?.length
        ? `\n## Follow-ups\n${parsed.followUps.map((f: string) => `- ${f}`).join("\n")}`
        : "",
    ].filter(Boolean).join("\n");

    // Store structured report
    await supabase
      .from("team_meetings")
      .update({
        notes: notesText,
        ai_summary: parsed.executiveSummary,
        participants: participantNames,
        duration_seconds: Math.round(durationMs / 1000),
        structured_report: parsed,
      })
      .eq("id", meetingId);

    // Auto-create action items as drafts
    if (parsed.actionItems?.length > 0) {
      const actionRows = parsed.actionItems.map((a: any) => {
        // Try to match assignee to a profile
        const matchedProfile = (profiles || []).find(
          (p: any) => p.full_name?.toLowerCase() === a.assignee?.toLowerCase()
        );
        return {
          meeting_id: meetingId,
          title: a.task,
          assignee_name: a.assignee || null,
          assignee_profile_id: matchedProfile?.id || null,
          due_date: a.dueDate || null,
          priority: a.priority || "medium",
          status: "draft",
          confidence: a.confidence || 0.5,
          company_id: meeting.company_id || null,
        };
      });

      const { error: actionErr } = await supabase
        .from("meeting_action_items")
        .insert(actionRows);
      if (actionErr) console.error("Failed to create action items:", actionErr);
    }

    // Save to Brain
    await supabase.from("knowledge").insert({
      title: `Meeting Notes: ${meeting.title}`,
      category: "meetings",
      content: notesText,
      metadata: {
        meeting_id: meetingId,
        meeting_type: meeting.meeting_type,
        channel_id: meeting.channel_id,
        duration_minutes: durationMin,
        participants: participantNames,
        participant_contributions: participantContributions,
        action_items: parsed.actionItems || [],
        decisions: parsed.decisions || [],
        risks: parsed.risks || [],
        started_at: startedAt,
        ended_at: endedAt,
        has_recording: !!meeting.recording_url,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        report: parsed,
        notes: notesText,
        participants: participantNames,
        participantContributions,
        duration_minutes: durationMin,
        actionItemsCreated: parsed.actionItems?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Summarize meeting error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
