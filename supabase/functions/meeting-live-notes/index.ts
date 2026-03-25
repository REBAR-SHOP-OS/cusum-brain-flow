import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI } from "../_shared/aiRouter.ts";
import { json } from "../_shared/auth.ts";

/**
 * AI-powered live meeting note-taker. Analyzes transcript and produces structured notes.
 * Migrated to handleRequest wrapper (Phase 1.2).
 */
serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { meetingId, transcript, previousNotes } = body;
    if (!meetingId || !transcript) {
      throw json({ error: "meetingId and transcript are required" }, 400);
    }

    const result = await callAI({
      provider: "gpt",
      model: "gpt-4o-mini",
      agentName: "system",
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
        { role: "user", content: `Live meeting transcript:\n\n${transcript}` },
      ],
      temperature: 0.3,
    });

    let parsed;
    try {
      const cleaned = result.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        keyPoints: [result.content.slice(0, 200)],
        decisions: [],
        actionItems: [],
        questions: [],
        risks: [],
      };
    }

    return { success: true, notes: parsed };
  }, { functionName: "meeting-live-notes", requireCompany: false, wrapResult: false }),
);
