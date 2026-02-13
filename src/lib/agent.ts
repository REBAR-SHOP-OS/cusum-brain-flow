import { supabase } from "@/integrations/supabase/client";

export type AgentType = "sales" | "accounting" | "support" | "collections" | "estimation" | "social" | "eisenhower" | "bizdev" | "webbuilder" | "assistant" | "copywriting" | "talent" | "seo" | "growth" | "legal" | "shopfloor" | "delivery" | "email" | "data";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface PixelPost {
  caption: string;
  hashtags: string;
  imageUrl: string;
  platform: string;
  slot: string;
  theme: string;
  product: string;
}

export interface AgentResponse {
  reply: string;
  context?: Record<string, unknown>;
  createdNotifications?: { type: string; title: string; assigned_to_name?: string }[];
  nextSlot?: number | null;
  pixelPost?: PixelPost;
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
  attachedFiles?: AttachedFile[],
  pixelSlot?: number
): Promise<AgentResponse> {
  const { data, error } = await supabase.functions.invoke("ai-agent", {
    body: { agent, message, history, context, attachedFiles, pixelSlot },
  });

  if (error) {
    throw new Error(error.message || "Failed to get agent response");
  }

  return data as AgentResponse;
}
