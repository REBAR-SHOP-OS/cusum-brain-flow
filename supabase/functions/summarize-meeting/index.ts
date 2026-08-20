import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { callAI } from "../_shared/aiRouter.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabase, body } = ctx;

    const { meetingId } = body;
    if (!meetingId) throw new Error("meetingId is required");

    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: userId,
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

    const { data: meeting, error: meetingErr } = await supabase
      .from("team_meetings")
      .select("*")
      .eq("id", meetingId)
      .single();
    if (meetingErr || !meeting) throw new Error("Meeting not found");

    const { data: transcriptEntries } = await supabase
      .from("meeting_transcript_entries")
      .select("speaker_name, speaker_profile_id, text, timestamp_ms, language")
      .eq("meeting_id", meetingId)
      .eq("is_final", true)
      .order("timestamp_ms", { ascending: true })
      .limit(500);

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

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .limit(200);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));

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

    const participantNames = [
      ...new Set([
        ...(transcriptEntries || []).map((e: any) => e.speaker_name),
        ...(chatMessages || []).map((m: any) => profileMap.get(m.sender_profile_id)).filter(Boolean),
      ]),
    ];

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

    const result = await callAI({
      provider: "gpt",
      model: "gpt-4o",
      agentName: "system",
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
    });

    const rawContent = result.content;

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

    if (parsed.actionItems?.length > 0) {
      const actionRows = parsed.actionItems.map((a: any) => {
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

    return {
      success: true,
      report: parsed,
      notes: notesText,
      participants: participantNames,
      participantContributions,
      duration_minutes: durationMin,
      actionItemsCreated: parsed.actionItems?.length || 0,
    };
  }, { functionName: "summarize-meeting", requireCompany: false, wrapResult: false })
);
