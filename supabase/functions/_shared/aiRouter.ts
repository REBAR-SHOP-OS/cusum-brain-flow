/**
 * Shared AI Router — routes requests to GPT (OpenAI) or Gemini (Google) directly.
 * Eliminates Lovable AI gateway dependency.
 */

export type AIProvider = "gpt" | "gemini";

export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

export interface AIRequestOptions {
  provider?: AIProvider;
  model?: string;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  tools?: unknown[];
  toolChoice?: unknown;
  stream?: boolean;
  signal?: AbortSignal;
  fallback?: { provider: AIProvider; model: string };
}

export interface AIResult {
  raw: any;
  content: string;
  toolCalls: any[];
  provider: AIProvider;
  model: string;
}

const GPT_BASE = "https://api.openai.com/v1/chat/completions";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

function getProviderConfig(provider: AIProvider): { url: string; apiKey: string } {
  if (provider === "gemini") {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY not configured");
    return { url: GEMINI_BASE, apiKey: key };
  }
  // Default: GPT
  const key = Deno.env.get("GPT_API_KEY");
  if (!key) throw new Error("GPT_API_KEY not configured");
  return { url: GPT_BASE, apiKey: key };
}

export async function callAI(opts: AIRequestOptions): Promise<AIResult> {
  const provider = opts.provider || "gpt";
  const model = opts.model || "gpt-4o";

  try {
    return await _callAISingle(provider, model, opts);
  } catch (e) {
    if (e instanceof AIError && e.status === 429 && opts.fallback) {
      console.warn(`AI ${model} rate-limited, falling back to ${opts.fallback.provider}`);
      return await _callAISingle(opts.fallback.provider, opts.fallback.model, opts);
    }
    throw e;
  }
}

async function _callAISingle(provider: AIProvider, model: string, opts: AIRequestOptions): Promise<AIResult> {
  const { url, apiKey } = getProviderConfig(provider);

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.5,
  };

  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new AIError(`AI API error: ${response.status} — ${errText}`, response.status);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  return {
    raw: data,
    content: choice?.message?.content || "",
    toolCalls: choice?.message?.tool_calls || [],
    provider,
    model,
  };
}

export class AIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AIError";
    this.status = status;
  }
}

// Intelligent model routing logic moved here
export function selectModel(agent: string, message: string, hasAttachments: boolean, historyLength: number): {
  model: string;
  maxTokens: number;
  temperature: number;
  reason: string;
  provider: AIProvider;
} {
  // Estimation + Docs → Gemini Pro
  if (agent === "estimation" && hasAttachments) {
    return { provider: "gemini", model: "gemini-2.5-pro", maxTokens: 8000, temperature: 0.1, reason: "estimation+docs" };
  }

  // Briefings → Gemini Pro
  if (/briefing|daily|report/i.test(message)) {
    return { provider: "gemini", model: "gemini-2.5-pro", maxTokens: 6000, temperature: 0.2, reason: "briefing context" };
  }

  // Complex reasoning → GPT-4o
  if (["accounting", "legal", "empire"].includes(agent) || /analyze|strategy|plan/i.test(message)) {
    return { provider: "gpt", model: "gpt-4o", maxTokens: 4000, temperature: 0.2, reason: "complex reasoning" };
  }

  // Default → GPT-4o-mini
  return { provider: "gpt", model: "gpt-4o-mini", maxTokens: 2000, temperature: 0.5, reason: "default fast" };
}
