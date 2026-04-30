import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

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
  targetModule: string;
  actionType: string;
  riskLevel: VoiceRiskLevel;
  requiredPermission: string | null;
  requiresConfirmation: boolean;
  payload: Record<string, unknown>;
  confidenceScore: number;
};

type VoiceResponse = {
  requestId?: string;
  status: VoiceStatus;
  intent?: VoiceIntent;
  resultSummary?: string;
  errorSummary?: string;
  confirmationExpiresAt?: string;
};

const ACTION_REGISTRY: Record<string, { module: string; requiredPermission: string; riskLevel: VoiceRiskLevel; requiresConfirmation: boolean }> = {
  "email.draft": {
    module: "communications",
    requiredPermission: "ai.use",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  "email.send_external": {
    module: "communications",
    requiredPermission: "ai.use",
    riskLevel: "high",
    requiresConfirmation: true,
  },
  "customer.search": {
    module: "customers",
    requiredPermission: "customers.read",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  "order.status_read": {
    module: "orders",
    requiredPermission: "orders.read",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  "order.add_note": {
    module: "orders",
    requiredPermission: "orders.update",
    riskLevel: "medium",
    requiresConfirmation: true,
  },
  "delivery.status_read": {
    module: "logistics",
    requiredPermission: "logistics.read",
    riskLevel: "low",
    requiresConfirmation: false,
  },
  "production.status_read": {
    module: "production",
    requiredPermission: "production.read",
    riskLevel: "low",
    requiresConfirmation: false,
  },
};

function normalizeStubIntent(transcript: string): VoiceIntent {
  const normalized = transcript.trim().toLowerCase();
  let actionKey = "customer.search";

  if (normalized.includes("email") || normalized.includes("draft")) actionKey = "email.draft";
  if (normalized.includes("send") && normalized.includes("email")) actionKey = "email.send_external";
  if (normalized.includes("delivery") || normalized.includes("deliveries")) actionKey = "delivery.status_read";
  if (normalized.includes("production") || normalized.includes("shop")) actionKey = "production.status_read";
  if (normalized.includes("order") && normalized.includes("note")) actionKey = "order.add_note";
  if (normalized.includes("order") && !normalized.includes("note")) actionKey = "order.status_read";

  const action = ACTION_REGISTRY[actionKey];

  return {
    rawTranscript: transcript,
    normalizedIntent: normalized || "empty request",
    targetModule: action.module,
    actionType: actionKey,
    riskLevel: action.riskLevel,
    requiredPermission: action.requiredPermission,
    requiresConfirmation: action.requiresConfirmation,
    payload: { transcript },
    confidenceScore: 0.72,
  };
}

async function writeActivityEvent(ctx: any, eventType: string, metadata: Record<string, unknown>) {
  try {
    await ctx.serviceClient.from("activity_events").insert({
      company_id: ctx.companyId,
      user_id: ctx.userId,
      event_type: eventType,
      dedupe_key: `voice-${eventType}-${crypto.randomUUID()}`,
      metadata,
    });
  } catch (error) {
    ctx.log.warn("Failed to write voice activity event", { eventType, error: error instanceof Error ? error.message : String(error) });
  }
}

serve((req) =>
  handleRequest(
    req,
    async (ctx): Promise<VoiceResponse | { ok: false; error: string }> => {
      const { body } = ctx;
      const mode = body?.mode as "parse" | "execute" | "confirm" | "reject" | undefined;

      if (!mode) {
        return { ok: false, error: "Missing mode" };
      }

      if (mode === "parse") {
        const transcript = String(body?.transcript || "").trim();
        if (!transcript) {
          return { ok: false, error: "Missing transcript" };
        }

        const intent = normalizeStubIntent(transcript);
        const status: VoiceStatus = intent.requiresConfirmation ? "pending_confirmation" : "parsed";
        const requestId = crypto.randomUUID();
        const confirmationExpiresAt = intent.requiresConfirmation
          ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
          : undefined;

        await writeActivityEvent(ctx, "voice.intent.parsed", { requestId, intent, status });

        return {
          requestId,
          status,
          intent,
          confirmationExpiresAt,
          resultSummary: intent.requiresConfirmation
            ? "Request parsed. Confirmation is required before execution."
            : "Request parsed and ready for safe execution.",
        };
      }

      if (mode === "confirm") {
        const requestId = String(body?.requestId || "");
        if (!requestId) return { ok: false, error: "Missing requestId" };

        await writeActivityEvent(ctx, "voice.confirmation.accepted", { requestId });

        return {
          requestId,
          status: "completed",
          resultSummary: "Action confirmed and executed through the safe router stub.",
        };
      }

      if (mode === "reject") {
        const requestId = String(body?.requestId || "");
        if (!requestId) return { ok: false, error: "Missing requestId" };

        await writeActivityEvent(ctx, "voice.confirmation.rejected", { requestId });

        return {
          requestId,
          status: "rejected",
          resultSummary: "Voice action rejected. Nothing was executed.",
        };
      }

      if (mode === "execute") {
        const intent = body?.intent as VoiceIntent | undefined;
        if (!intent?.actionType) return { ok: false, error: "Missing intent" };

        const registered = ACTION_REGISTRY[intent.actionType];
        if (!registered) {
          await writeActivityEvent(ctx, "voice.action.failed", { intent, reason: "unknown_action" });
          return {
            status: "failed",
            intent,
            errorSummary: "Unknown voice action. Execution blocked.",
          };
        }

        if (registered.requiresConfirmation || intent.requiresConfirmation) {
          return {
            requestId: String(body?.requestId || crypto.randomUUID()),
            status: "pending_confirmation",
            intent,
            resultSummary: "Confirmation required before this action can execute.",
            confirmationExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          };
        }

        await writeActivityEvent(ctx, "voice.action.executed", { intent, mode });

        return {
          requestId: String(body?.requestId || crypto.randomUUID()),
          status: "completed",
          intent,
          resultSummary: `Executed ${intent.actionType} safely through the voice action router stub.`,
        };
      }

      return { ok: false, error: "Invalid mode" };
    },
    {
      functionName: "voice-action-router",
      requireCompany: true,
    },
  ),
);
