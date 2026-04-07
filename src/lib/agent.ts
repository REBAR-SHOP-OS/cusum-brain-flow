import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

export type AgentType = "sales" | "accounting" | "support" | "social" | "eisenhower" | "bizdev" | "webbuilder" | "assistant" | "copywriting" | "talent" | "seo" | "growth" | "legal" | "shopfloor" | "delivery" | "email" | "data" | "empire" | "purchasing" | "azin" | "rebuild" | "estimating";

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
  slotNumber?: number; // 1-5
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
  try {
    const data = await invokeEdgeFunction<AgentResponse>("ai-agent", {
      agent, message, history, context, attachedFiles, pixelSlot, preferredModel,
    }, { timeoutMs: 180_000, retries: 1 });

    // Check if response contains an error instead of a reply
    if (data && typeof data === "object" && "error" in data && !("reply" in data)) {
      const errMsg = (data as any).error;
      if (typeof errMsg === "string" && errMsg.toLowerCase().includes("rate limit")) {
        throw new Error("Rate limit reached — please wait a moment before trying again.");
      }
      throw new Error(errMsg || "Agent returned an error");
    }

    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("timed out")) {
      throw new Error("The request timed out — the agent is working on a complex task. Please try again in a moment.");
    }
    if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
      throw new Error("Rate limit reached — please wait a moment before trying again.");
    }
    throw err;
  }
}
