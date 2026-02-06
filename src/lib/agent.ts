import { supabase } from "@/integrations/supabase/client";

export type AgentType = "sales" | "accounting" | "support" | "collections" | "estimation";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentResponse {
  reply: string;
  context?: Record<string, unknown>;
}

export async function sendAgentMessage(
  agent: AgentType,
  message: string,
  history?: ChatMessage[],
  context?: Record<string, unknown>
): Promise<AgentResponse> {
  const { data, error } = await supabase.functions.invoke("ai-agent", {
    body: { agent, message, history, context },
  });

  if (error) {
    throw new Error(error.message || "Failed to get agent response");
  }

  return data as AgentResponse;
}
