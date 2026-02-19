import { supabase } from "@/integrations/supabase/client";

export type AgentType = "sales" | "accounting" | "support" | "collections" | "estimation" | "social" | "eisenhower" | "bizdev" | "webbuilder" | "assistant" | "copywriting" | "talent" | "seo" | "growth" | "legal" | "shopfloor" | "delivery" | "email" | "data" | "commander" | "empire";

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
    // Detect rate-limit errors from the edge function
    const msg = error.message || "";
    if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
      throw new Error("Rate limit reached — please wait a moment before trying again.");
    }
    throw new Error(msg || "Failed to get agent response");
  }

  // Also check if data itself contains an error (edge function returned 200 with error body)
  if (data && typeof data === "object" && "error" in data && !("reply" in data)) {
    const errMsg = (data as any).error;
    if (typeof errMsg === "string" && errMsg.toLowerCase().includes("rate limit")) {
      throw new Error("Rate limit reached — please wait a moment before trying again.");
    }
    throw new Error(errMsg || "Agent returned an error");
  }

  return data as AgentResponse;
}
