import { supabase } from "@/integrations/supabase/client";

export type VoiceRiskLevel = "low" | "medium" | "high";

export type VoiceStatus =
  | "parsed"
  | "pending_confirmation"
  | "confirmed"
  | "rejected"
  | "executing"
  | "completed"
  | "failed"
  | "permission_denied";

export interface VoiceActionIntent {
  rawTranscript: string;
  normalizedIntent: string;
  targetModule: string;
  actionType: string;
  riskLevel: VoiceRiskLevel;
  requiredPermission?: string;
  requiresConfirmation: boolean;
  payload: Record<string, any> & {
    to?: string;
    subject?: string;
    body?: string;
    prompt?: string;
    recipientName?: string;
    tone?: string;
    missingFields?: string[];
  };
  confidenceScore?: number;
}

export interface VoiceActionResponse {
  requestId?: string;
  status: VoiceStatus;
  intent?: VoiceActionIntent;
  resultSummary?: string;
  errorSummary?: string;
  confirmationExpiresAt?: string;
  data?: Record<string, unknown>;
}

async function invokeRouter(body: Record<string, unknown>): Promise<VoiceActionResponse> {
  const { data, error } = await supabase.functions.invoke("voice-action-router", { body });
  if (error) throw new Error(error.message || "Voice agent request failed");
  if (data && typeof data === "object" && "ok" in data && (data as any).ok === false) {
    throw new Error((data as any).error || "Voice agent request failed");
  }
  return data as VoiceActionResponse;
}

export function parseVoiceIntent(transcript: string): Promise<VoiceActionResponse> {
  return invokeRouter({ mode: "parse", transcript });
}

export function executeVoiceIntent(
  intent: VoiceActionIntent,
  requestId?: string,
): Promise<VoiceActionResponse> {
  return invokeRouter({ mode: "execute", intent, requestId });
}

export function confirmVoiceAction(
  requestId: string,
  intent?: VoiceActionIntent,
): Promise<VoiceActionResponse> {
  return invokeRouter({ mode: "confirm", requestId, intent });
}

export function rejectVoiceAction(requestId: string): Promise<VoiceActionResponse> {
  return invokeRouter({ mode: "reject", requestId });
}
