import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI } from "../_shared/aiRouter.ts";

type VoiceRiskLevel = "low" | "medium" | "high";
type VoiceStatus =
  | "parsed"
  | "pending_confirmation"
  | "confirmed"
  | "rejected"
  | "executing"
  | "completed"
  | "failed"
  | "permission_denied";

type VoiceIntent = {
  rawTranscript: string;
  normalizedIntent: string;
  targetModule: "communications";
  actionType: "email.draft" | "email.send_external";
  riskLevel: VoiceRiskLevel;
  requiredPermission: "ai.use";
  requiresConfirmation: boolean;
  payload: {
    to?: string;
    subject?: string;
    body?: string;
    prompt?: string;
    recipientName?: string;
    tone?: "professional" | "friendly" | "formal" | "urgent" | "short";
    missingFields?: string[];
  };
  confidenceScore: number;
};

type VoiceResponse = {
  requestId?: string;
  status: VoiceStatus;
  intent?: VoiceIntent;
  resultSummary?: string;
  errorSummary?: string;
  confirmationExpiresAt?: string;
  data?: Record<string, unknown>;
};

async function writeActivityEvent(ctx: any, eventType: string, metadata: Record<string, unknown>) {
  try {
    await ctx.serviceClient.from("activity_events").insert({
      company_id: ctx.companyId,
      user_id: ctx.userId,
      event_type: eventType,
      dedupe_key: `voice-email-${eventType}-${crypto.randomUUID()}`,
      metadata,
    });
  } catch (error) {
    ctx.log.warn("Failed to write voice email activity event", {
      eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function extractEmail(text: string): string | undefined {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
}

function cleanJsonText(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function coerceActionType(value: unknown, transcript: string): "email.draft" | "email.send_external" {
  const raw = String(value || "").trim();
  if (raw === "email.send_external") return "email.send_external";
  if (raw === "email.draft") return "email.draft";
  const lower = transcript.toLowerCase();
  return lower.includes("send") || lower.includes("email out") || lower.includes("send it")
    ? "email.send_external"
    : "email.draft";
}

function clampConfidence(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.65;
  return Math.max(0, Math.min(1, n));
}

function normalizeParsedIntent(transcript: string, parsed: Record<string, unknown>): VoiceIntent {
  const actionType = coerceActionType(parsed.actionType, transcript);
  const payload = (parsed.payload && typeof parsed.payload === "object" ? parsed.payload : {}) as VoiceIntent["payload"];
  const extractedEmail = extractEmail(transcript);
  const to = typeof payload.to === "string" && payload.to.includes("@") ? payload.to : extractedEmail;
  const missingFields = Array.isArray(payload.missingFields) ? payload.missingFields.map(String) : [];

  if (actionType === "email.send_external" && !to && !missingFields.includes("to")) {
    missingFields.push("to");
  }

  return {
    rawTranscript: transcript,
    normalizedIntent: String(parsed.normalizedIntent || (actionType === "email.send_external" ? "send external email" : "draft email")),
    targetModule: "communications",
    actionType,
    riskLevel: actionType === "email.send_external" ? "high" : "low",
    requiredPermission: "ai.use",
    requiresConfirmation: actionType === "email.send_external",
    payload: {
      to,
      subject: typeof payload.subject === "string" && payload.subject.trim() ? payload.subject.trim() : undefined,
      body: typeof payload.body === "string" && payload.body.trim() ? payload.body.trim() : undefined,
      prompt: typeof payload.prompt === "string" && payload.prompt.trim() ? payload.prompt.trim() : transcript,
      recipientName: typeof payload.recipientName === "string" ? payload.recipientName : undefined,
      tone: typeof payload.tone === "string" ? payload.tone as VoiceIntent["payload"]["tone"] : "professional",
      missingFields,
    },
    confidenceScore: clampConfidence(parsed.confidenceScore),
  };
}

async function parseEmailIntentWithAI(ctx: any, transcript: string): Promise<VoiceIntent> {
  const result = await callAI({
    provider: "gpt",
    model: "gpt-4o-mini",
    agentName: "voice-email-intent-parser",
    messages: [
      {
        role: "system",
        content: `You are a secure enterprise voice intent parser for Rebar.Shop.

Scope:
- ONLY email workflows are allowed.
- Allowed actionType values: "email.draft" and "email.send_external".
- If user asks to send, transmit, email out, or "send it", use "email.send_external".
- If user asks to write, compose, create, prepare, draft, or reply without explicit send, use "email.draft".
- Sending is always high risk and requires confirmation.
- Drafting is low risk and does not send anything.

Return STRICT JSON ONLY. No markdown. No explanation.
Schema:
{
  "normalizedIntent": string,
  "actionType": "email.draft" | "email.send_external",
  "payload": {
    "to": string | null,
    "recipientName": string | null,
    "subject": string | null,
    "body": string | null,
    "prompt": string,
    "tone": "professional" | "friendly" | "formal" | "urgent" | "short",
    "missingFields": string[]
  },
  "confidenceScore": number
}

Rules:
- Extract email addresses exactly when present.
- If no recipient email is present for send, include "to" in missingFields.
- Do not invent email addresses.
- Subject should be concise and business-ready.
- Body may be null unless the user clearly dictated exact body text.
- Prompt must preserve the user's original business instruction.
- confidenceScore must be between 0 and 1.`,
      },
      { role: "user", content: transcript },
    ],
    maxTokens: 700,
    temperature: 0.1,
  });

  try {
    const parsed = JSON.parse(cleanJsonText(result.content || "{}"));
    return normalizeParsedIntent(transcript, parsed);
  } catch (error) {
    ctx.log.warn("AI intent parse failed, falling back to deterministic email parse", {
      error: error instanceof Error ? error.message : String(error),
    });
    const actionType = transcript.toLowerCase().includes("send") ? "email.send_external" : "email.draft";
    return normalizeParsedIntent(transcript, {
      normalizedIntent: actionType === "email.send_external" ? "send external email" : "draft email",
      actionType,
      payload: {
        to: extractEmail(transcript) || null,
        subject: null,
        body: null,
        prompt: transcript,
        tone: "professional",
        missingFields: actionType === "email.send_external" && !extractEmail(transcript) ? ["to"] : [],
      },
      confidenceScore: 0.55,
    });
  }
}

async function generateDraft(ctx: any, intent: VoiceIntent) {
  const prompt = intent.payload.prompt || intent.rawTranscript;
  const result = await callAI({
    provider: "gpt",
    model: "gpt-4o-mini",
    agentName: "voice-email-agent",
    messages: [
      {
        role: "system",
        content:
          "You are Cassie, Rebar.Shop's professional email assistant. Write concise, clear business emails. Return ONLY JSON with keys subject and body. Body should be plain text, professional, and ready for user review.",
      },
      {
        role: "user",
        content: `Voice request: ${prompt}\nRecipient: ${intent.payload.to || intent.payload.recipientName || "not specified"}\nSuggested subject: ${intent.payload.subject || "Follow-up"}\nTone: ${intent.payload.tone || "professional"}\nExisting dictated body: ${intent.payload.body || "none"}`,
      },
    ],
    maxTokens: 700,
    temperature: 0.35,
  });

  const text = result.content || "";
  let subject = intent.payload.subject || "Follow-up";
  let body = intent.payload.body || text;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch?.[0] || text);
    subject = parsed.subject || subject;
    body = parsed.body || body;
  } catch {
    // Keep model text as body if JSON parsing fails.
  }

  return { subject, body };
}

async function requireEmailRole(ctx: any) {
  const { requireAnyRole } = await import("../_shared/roleCheck.ts");
  await requireAnyRole(ctx.serviceClient, ctx.userId, ["admin", "sales", "office", "marketing"]);
}

serve((req) =>
  handleRequest(
    req,
    async (ctx): Promise<VoiceResponse | { ok: false; error: string }> => {
      const { body } = ctx;
      const mode = body?.mode as "parse" | "execute" | "confirm" | "reject" | undefined;

      if (!mode) return { ok: false, error: "Missing mode" };

      if (mode === "parse") {
        const transcript = String(body?.transcript || "").trim();
        if (!transcript) return { ok: false, error: "Missing transcript" };

        const intent = await parseEmailIntentWithAI(ctx, transcript);
        const requestId = crypto.randomUUID();
        const status: VoiceStatus = intent.requiresConfirmation ? "pending_confirmation" : "parsed";
        const confirmationExpiresAt = intent.requiresConfirmation
          ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
          : undefined;

        await writeActivityEvent(ctx, "voice.email.intent.parsed", { requestId, intent, status, parser: "ai" });

        return {
          requestId,
          status,
          intent,
          confirmationExpiresAt,
          resultSummary: intent.requiresConfirmation
            ? "Email send request parsed by AI. Confirmation is required before sending."
            : "Email draft request parsed by AI. Ready to generate draft.",
        };
      }

      if (mode === "execute") {
        const intent = body?.intent as VoiceIntent | undefined;
        if (!intent?.actionType) return { ok: false, error: "Missing intent" };
        if (intent.targetModule !== "communications") return { ok: false, error: "Only email workflows are enabled for voice agent." };

        await requireEmailRole(ctx);

        if (intent.actionType === "email.send_external" || intent.requiresConfirmation) {
          return {
            requestId: String(body?.requestId || crypto.randomUUID()),
            status: "pending_confirmation",
            intent,
            resultSummary: "External email sending requires confirmation before execution.",
            confirmationExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          };
        }

        const draft = await generateDraft(ctx, intent);
        await writeActivityEvent(ctx, "voice.email.draft.generated", { intent, draft: { subject: draft.subject, hasBody: !!draft.body } });

        return {
          requestId: String(body?.requestId || crypto.randomUUID()),
          status: "completed",
          intent: { ...intent, payload: { ...intent.payload, subject: draft.subject, body: draft.body } },
          resultSummary: "Email draft generated for review. Nothing was sent.",
          data: draft,
        };
      }

      if (mode === "confirm") {
        const requestId = String(body?.requestId || "");
        const intent = body?.intent as VoiceIntent | undefined;
        if (!requestId) return { ok: false, error: "Missing requestId" };
        if (!intent?.payload?.to) {
          return {
            requestId,
            status: "failed",
            intent,
            errorSummary: "Recipient email is required before sending.",
          };
        }

        await requireEmailRole(ctx);
        const subject = intent.payload.subject || "Follow-up";
        const bodyText = intent.payload.body || (await generateDraft(ctx, intent)).body;

        const authHeader = ctx.req.headers.get("Authorization") || "";
        const sendResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-send`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: intent.payload.to,
            subject,
            body: bodyText.replace(/\n/g, "<br>"),
            sent_by_agent: true,
            custom_headers: {
              "X-Rebar-Voice-Agent": "true",
              "X-Rebar-Voice-Request-Id": requestId,
            },
          }),
        });

        const sendJson = await sendResponse.json().catch(() => ({}));
        if (!sendResponse.ok || sendJson?.error) {
          await writeActivityEvent(ctx, "voice.email.send.failed", { requestId, intent, sendJson });
          return {
            requestId,
            status: "failed",
            intent,
            errorSummary: sendJson?.error || `Email send failed (${sendResponse.status})`,
          };
        }

        await writeActivityEvent(ctx, "voice.email.sent", { requestId, intent, messageId: sendJson?.messageId, threadId: sendJson?.threadId });

        return {
          requestId,
          status: "completed",
          intent,
          resultSummary: `Email sent to ${intent.payload.to}.`,
          data: sendJson,
        };
      }

      if (mode === "reject") {
        const requestId = String(body?.requestId || "");
        if (!requestId) return { ok: false, error: "Missing requestId" };
        await writeActivityEvent(ctx, "voice.email.confirmation.rejected", { requestId });
        return { requestId, status: "rejected", resultSummary: "Email action rejected. Nothing was sent." };
      }

      return { ok: false, error: "Invalid mode" };
    },
    {
      functionName: "voice-action-router",
      requireCompany: true,
    },
  ),
);
