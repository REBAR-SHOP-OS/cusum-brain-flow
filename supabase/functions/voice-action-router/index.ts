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

function parseEmailIntent(transcript: string): VoiceIntent {
  const normalized = transcript.trim();
  const lower = normalized.toLowerCase();
  const wantsSend = lower.includes("send") || lower.includes("email out") || lower.includes("send it");
  const to = extractEmail(transcript);
  const actionType = wantsSend ? "email.send_external" : "email.draft";

  return {
    rawTranscript: transcript,
    normalizedIntent: wantsSend ? "send external email" : "draft email",
    targetModule: "communications",
    actionType,
    riskLevel: wantsSend ? "high" : "low",
    requiredPermission: "ai.use",
    requiresConfirmation: wantsSend,
    payload: {
      to,
      subject: lower.includes("quote") ? "Quote follow-up" : "Follow-up",
      prompt: transcript,
    },
    confidenceScore: to ? 0.84 : 0.72,
  };
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
        content: `Voice request: ${prompt}\nRecipient: ${intent.payload.to || "not specified"}\nSuggested subject: ${intent.payload.subject || "Follow-up"}`,
      },
    ],
    maxTokens: 700,
    temperature: 0.35,
  });

  const text = result.content || "";
  let subject = intent.payload.subject || "Follow-up";
  let body = text;

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

        const intent = parseEmailIntent(transcript);
        const requestId = crypto.randomUUID();
        const status: VoiceStatus = intent.requiresConfirmation ? "pending_confirmation" : "parsed";
        const confirmationExpiresAt = intent.requiresConfirmation
          ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
          : undefined;

        await writeActivityEvent(ctx, "voice.email.intent.parsed", { requestId, intent, status });

        return {
          requestId,
          status,
          intent,
          confirmationExpiresAt,
          resultSummary: intent.requiresConfirmation
            ? "Email send request parsed. Confirmation is required before sending."
            : "Email draft request parsed. Ready to generate draft.",
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
