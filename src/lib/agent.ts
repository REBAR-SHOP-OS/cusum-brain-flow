import { supabase } from "@/integrations/supabase/client";

export type AgentType = "sales" | "accounting" | "support" | "collections" | "estimation" | "social";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentResponse {
  reply: string;
  context?: Record<string, unknown>;
}

export interface AttachedFile {
  name: string;
  url: string;
}

export async function sendAgentMessage(
  agent: AgentType,
  message: string,
  history?: ChatMessage[],
  context?: Record<string, unknown>,
  attachedFiles?: AttachedFile[]
): Promise<AgentResponse> {
  const { data, error } = await supabase.functions.invoke("ai-agent", {
    body: { agent, message, history, context, attachedFiles },
  });

  if (error) {
    throw new Error(error.message || "Failed to get agent response");
  }

  return data as AgentResponse;
}
