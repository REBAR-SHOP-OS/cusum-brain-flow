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
  pixelSlot?: number,
  preferredModel?: string
): Promise<AgentResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);

  let data: unknown, invokeError: unknown;
  try {
    ({ data, error: invokeError } = await supabase.functions.invoke("ai-agent", {
      body: { agent, message, history, context, attachedFiles, pixelSlot, preferredModel },
      signal: controller.signal,
    }));
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("The request timed out — the agent is working on a complex task. Please try again in a moment.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const error = invokeError;

  if (error) {
    // Detect rate-limit errors from the edge function
    const msg = (error instanceof Error ? error.message : String(error)) || "";
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
