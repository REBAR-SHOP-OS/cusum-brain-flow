import { supabase } from "@/integrations/supabase/client";

export type AgentType = "sales" | "accounting" | "support" | "collections" | "estimation";

export interface AgentResponse {
  reply: string;
  context?: Record<string, unknown>;
}

export async function sendAgentMessage(
  agent: AgentType,
  message: string,
  context?: Record<string, unknown>
): Promise<AgentResponse> {
  const { data, error } = await supabase.functions.invoke("ai-agent", {
    body: { agent, message, context },
  });

  if (error) {
    throw new Error(error.message || "Failed to get agent response");
  }

  return data as AgentResponse;
}
