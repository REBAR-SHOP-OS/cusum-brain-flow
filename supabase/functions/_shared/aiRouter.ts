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
  agentName?: string;
  companyId?: string;
  userId?: string;
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
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await _callAISingle(provider, model, opts);
    } catch (e) {
      if (e instanceof AIError) {
        // Retry on transient errors (503/504) with exponential backoff
        if ((e.status === 503 || e.status === 504) && attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt);
          console.warn(`AI ${model} returned ${e.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        // Fallback on 429 or exhausted 503 retries
        if ((e.status === 429 || e.status === 503 || e.status === 504) && opts.fallback) {
          console.warn(`AI ${model} error ${e.status}, falling back to ${opts.fallback.model}`);
          return await _callAISingle(opts.fallback.provider, opts.fallback.model, opts);
        }
      }
      throw e;
    }
  }
  throw new Error("AI call exhausted all retries");
}

async function _callAISingle(provider: AIProvider, model: string, opts: AIRequestOptions): Promise<AIResult> {
  const { url, apiKey } = getProviderConfig(provider);

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.5,
  };

  // GPT-5 only supports temperature=1.0
  if (model.startsWith("gpt-5")) {
    body.temperature = 1;
  }

  if (opts.maxTokens) {
    // GPT-5 requires max_completion_tokens instead of max_tokens
    if (model.startsWith("gpt-5")) {
      body.max_completion_tokens = opts.maxTokens;
    } else {
      body.max_tokens = opts.maxTokens;
    }
  }
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

  // Fire-and-forget token usage logging
  _logUsage(provider, model, data.usage, opts).catch((e) =>
    console.warn("AI usage log failed:", e.message)
  );

  return {
    raw: data,
    content: choice?.message?.content || "",
    toolCalls: choice?.message?.tool_calls || [],
    provider,
    model,
  };
}

async function _callAIStreamSingle(provider: AIProvider, model: string, opts: AIRequestOptions): Promise<Response> {
  const { url, apiKey } = getProviderConfig(provider);

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.5,
    stream: true,
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

  return response; // Caller pipes response.body as SSE stream
}

export async function callAIStream(opts: AIRequestOptions): Promise<Response> {
  const provider = opts.provider || "gemini";
  const model = opts.model || "gemini-2.5-flash";

  try {
    return await _callAIStreamSingle(provider, model, opts);
  } catch (e) {
    if (e instanceof AIError && e.status === 429) {
      console.warn(`AI stream ${model} rate-limited (429), falling back to gemini-2.5-flash`);
      return await _callAIStreamSingle("gemini", "gemini-2.5-flash", opts);
    }
    throw e;
  }
}

async function _logUsage(
  provider: AIProvider,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  opts: AIRequestOptions
) {
  if (!usage) return;
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return;

  await fetch(`${url}/rest/v1/ai_usage_log`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      provider,
      model,
      agent_name: opts.agentName || null,
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      company_id: opts.companyId || null,
      user_id: opts.userId || null,
    }),
  });
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

  // Complex reasoning → Gemini 2.5 Pro (GPT quota exhausted; Pro model for depth & quality)
  if (["accounting", "legal", "empire", "commander", "data"].includes(agent) || /analyze|strategy|plan/i.test(message)) {
    return { provider: "gemini", model: "gemini-2.5-pro", maxTokens: 6000, temperature: 0.2, reason: "complex reasoning → gemini-pro" };
  }

  // Default → Gemini 2.5 Flash with generous token budget
  return { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 4000, temperature: 0.5, reason: "default fast" };
}
