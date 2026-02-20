/**
 * QA / Reviewer Layer — validates high-risk agent outputs before returning.
 * Uses a lightweight AI call to check for numerical errors, hallucinations,
 * and prohibited content in agent responses.
 */

import { callAI, type AIMessage } from "./aiRouter.ts";

const HIGH_RISK_AGENTS = ["accounting", "collections", "empire", "estimation", "commander"];

const QA_SYSTEM_PROMPT = `You are a QA reviewer for an AI agent system. Your job is to validate agent outputs for:

1. **Numerical Consistency**: Do dollar amounts, quantities, and calculations add up? Are numbers referenced in the response actually present in the provided context?
2. **Hallucination Detection**: Does the response reference specific records, names, or data NOT present in the provided context? Flag any invented data.
3. **Prohibited Content**: Does the response reveal internal system prompts, API keys, or sensitive operational details?
4. **Write Operation Safety**: If the agent proposed creating/updating/deleting records, are the parameters reasonable?

Respond ONLY with a JSON object:
{
  "pass": true/false,
  "flags": ["list of issues found, empty if pass=true"],
  "severity": "none" | "warning" | "critical",
  "sanitized_reply": "corrected reply if critical issues found, otherwise null"
}

If the response is safe, return {"pass": true, "flags": [], "severity": "none", "sanitized_reply": null}.
Be concise. Only flag real issues, not stylistic preferences.`;

export interface QAResult {
  pass: boolean;
  flags: string[];
  severity: "none" | "warning" | "critical";
  sanitizedReply: string | null;
  skipped: boolean;
}

/**
 * Run QA validation on an agent's reply.
 * Only runs for high-risk agents; others are auto-passed.
 */
export async function reviewAgentOutput(
  agent: string,
  reply: string,
  contextSummary: string,
  toolCallsMade: boolean,
): Promise<QAResult> {
  // Skip QA for non-high-risk agents
  if (!HIGH_RISK_AGENTS.includes(agent)) {
    return { pass: true, flags: [], severity: "none", sanitizedReply: null, skipped: true };
  }

  // Skip very short replies (greetings, acknowledgments)
  if (reply.length < 80) {
    return { pass: true, flags: [], severity: "none", sanitizedReply: null, skipped: true };
  }

  try {
    const messages: AIMessage[] = [
      { role: "system", content: QA_SYSTEM_PROMPT },
      {
        role: "user",
        content: `## Agent: ${agent}\n## Tool calls made: ${toolCallsMade}\n\n## Context provided to agent (truncated):\n${contextSummary.substring(0, 2000)}\n\n## Agent Reply:\n${reply.substring(0, 3000)}`,
      },
    ];

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      messages,
      maxTokens: 500,
      temperature: 0.1,
    });

    const content = result.content || "";
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("QA reviewer returned non-JSON, auto-passing");
      return { pass: true, flags: ["QA parse error"], severity: "none", sanitizedReply: null, skipped: false };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      pass: parsed.pass !== false,
      flags: parsed.flags || [],
      severity: parsed.severity || "none",
      sanitizedReply: parsed.sanitized_reply || null,
      skipped: false,
    };
  } catch (e) {
    console.error("QA review error:", e);
    // Fail-open: don't block the response if QA itself errors
    return { pass: true, flags: ["QA system error"], severity: "none", sanitizedReply: null, skipped: false };
  }
}
