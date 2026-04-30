import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

serve((req) =>
  handleRequest(
    req,
    async (ctx) => {
      const { body, userId, companyId } = ctx;
      const mode = body?.mode as "parse" | "execute" | "confirm" | "reject";

      if (!mode) {
        return { ok: false, error: "Missing mode" };
      }

      // ---------------- PARSE ----------------
      if (mode === "parse") {
        const transcript: string = body?.transcript || "";

        // TODO: Replace with LLM (OpenAI/Gemini) call
        const intent = {
          rawTranscript: transcript,
          normalizedIntent: transcript.toLowerCase(),
          targetModule: "sales",
          actionType: "draft_email",
          riskLevel: "low",
          requiredPermission: "sales.email.create",
          requiresConfirmation: false,
          payload: { subject: "Draft from voice" },
          confidenceScore: 0.72,
        };

        return {
          status: "parsed",
          intent,
        };
      }

      // ---------------- CONFIRM ----------------
      if (mode === "confirm") {
        const requestId = body?.requestId;

        // TODO: load request + validate ownership + confirm flag
        return {
          requestId,
          status: "completed",
          resultSummary: "Action confirmed and executed (stub)",
        };
      }

      // ---------------- REJECT ----------------
      if (mode === "reject") {
        const requestId = body?.requestId;

        return {
          requestId,
          status: "rejected",
        };
      }

      // ---------------- EXECUTE ----------------
      if (mode === "execute") {
        const intent = body?.intent;

        // TODO: permission check + action router

        return {
          status: "completed",
          resultSummary: `Executed ${intent?.actionType || "action"} safely (stub)",
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
