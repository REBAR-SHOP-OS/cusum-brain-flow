/**
 * Shared AI Router — routes requests to GPT (OpenAI) or Gemini (Google) directly.
 * Eliminates Lovable AI gateway dependency.
 *
 * Provider selection:
 *   - GPT (default): reasoning, chat, precision tasks
 *   - Gemini: large context, multimodal (vision), bulk analysis
 *
 * Usage:
 *   import { callAI, type AIProvider } from "../_shared/aiRouter.ts";
 *   const result = await callAI({ provider: "gpt", model: "gpt-4o", messages, ... });
 */

// ── Types ──────────────────────────────────────────────────────────────

export type AIProvider = "gpt" | "gemini";

export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

export interface AIRequestOptions {
  /** "gpt" (default) or "gemini" */
  provider?: AIProvider;
  /** Model name — provider-native (e.g. "gpt-4o", "gemini-2.5-flash") */
  model?: string;
  messages: AIMessage[];
  maxTokens?: number;
  temperature?: number;
  /** OpenAI-format tools array */
  tools?: unknown[];
  toolChoice?: unknown;
  /** Enable SSE streaming */
  stream?: boolean;
  /** AbortSignal for timeouts */
  signal?: AbortSignal;
}

export interface AIResult {
  /** Full response object from the provider */
  raw: any;
  /** Extracted text content from first choice */
  content: string;
  /** Tool calls from first choice (if any) */
  toolCalls: any[];
  /** The provider that was actually used */
  provider: AIProvider;
  /** The model that was used */
  model: string;
}

// ── Provider configs ───────────────────────────────────────────────────

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

// ── Default models per provider ────────────────────────────────────────

const DEFAULT_MODELS: Record<AIProvider, string> = {
  gpt: "gpt-4o",
  gemini: "gemini-2.5-flash",
};

// ── Main call function ─────────────────────────────────────────────────

/**
 * Call AI with automatic provider routing.
 * Returns parsed result for non-streaming, or raw Response for streaming.
 */
export async function callAI(opts: AIRequestOptions): Promise<AIResult> {
  const provider = opts.provider || "gpt";
  const model = opts.model || DEFAULT_MODELS[provider];
  const { url, apiKey } = getProviderConfig(provider);

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.5,
  };

  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;
  if (opts.stream) body.stream = true;

  const response = await fetchWithRetry(url, apiKey, body, opts.signal);

  if (opts.stream) {
    // For streaming, caller should use callAIStream instead
    throw new Error("Use callAIStream() for streaming requests");
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

/**
 * Stream AI response — returns the raw Response with SSE body.
 * Caller is responsible for parsing the stream.
 */
export async function callAIStream(opts: AIRequestOptions): Promise<Response> {
  const provider = opts.provider || "gpt";
  const model = opts.model || DEFAULT_MODELS[provider];
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

  return await fetchWithRetry(url, apiKey, body, opts.signal);
}

// ── Retry logic ────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
  maxRetries = 2
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    if (response.ok) return response;

    // Non-retryable errors
    if (response.status === 429) {
      throw new AIError("Rate limit exceeded. Please try again in a moment.", 429);
    }
    if (response.status === 401 || response.status === 403) {
      throw new AIError("AI API authentication failed. Check API key.", response.status);
    }
    if (response.status === 402) {
      throw new AIError("AI API billing issue. Check your account.", 402);
    }

    // Retryable errors (500, 503)
    if ((response.status === 500 || response.status === 503) && attempt < maxRetries) {
      const errText = await response.text();
      console.warn(`AI ${body.model} error (attempt ${attempt + 1}/${maxRetries + 1}): ${response.status} — retrying...`);
      await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      continue;
    }

    // Other errors — don't retry
    const errText = await response.text();
    throw new AIError(`AI API error: ${response.status} — ${errText}`, response.status);
  }

  throw new AIError("AI request failed after retries", 500);
}

// ── Error class ────────────────────────────────────────────────────────

export class AIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AIError";
    this.status = status;
  }
}

// ── Model mapping helpers ──────────────────────────────────────────────

/**
 * Maps old Lovable gateway model names to provider-native equivalents.
 * Use during migration to convert existing selectModel() outputs.
 */
export function mapLovableModel(lovableModel: string): { provider: AIProvider; model: string } {
  // Strip "google/" prefix if present
  const m = lovableModel.replace(/^google\//, "");

  // Gemini models → use Gemini directly
  if (m.startsWith("gemini-")) {
    return { provider: "gemini", model: m };
  }

  // Map Lovable gateway model names to GPT equivalents
  const gptMap: Record<string, string> = {
    "openai/gpt-5": "gpt-4o",
    "openai/gpt-5-mini": "gpt-4o-mini",
    "openai/gpt-5-nano": "gpt-4o-mini",
    "gpt-5": "gpt-4o",
    "gpt-5-mini": "gpt-4o-mini",
  };

  if (gptMap[lovableModel]) {
    return { provider: "gpt", model: gptMap[lovableModel] };
  }

  // Default: GPT
  return { provider: "gpt", model: "gpt-4o" };
}

/**
 * Convert old selectModel output to new router format.
 * Preserves the intelligent routing logic, just changes the provider.
 *
 * Strategy:
 *   - Pro/large context tasks → Gemini (context window advantage)
 *   - Vision/multimodal → Gemini (native multimodal)
 *   - Precision reasoning → GPT (stronger at structured output)
 *   - Quick/simple tasks → GPT-mini (fast + cheap)
 *   - Creative writing → GPT (better at nuance)
 */
export function routeModel(oldModel: string, opts?: {
  hasAttachments?: boolean;
  isLargeContext?: boolean;
}): { provider: AIProvider; model: string } {
  const m = oldModel.replace(/^google\//, "");

  // Vision/multimodal always Gemini
  if (opts?.hasAttachments) {
    if (m.includes("pro")) return { provider: "gemini", model: "gemini-2.5-pro" };
    return { provider: "gemini", model: "gemini-2.5-flash" };
  }

  // Large context (briefings, digests) → Gemini
  if (opts?.isLargeContext) {
    if (m.includes("pro")) return { provider: "gemini", model: "gemini-2.5-pro" };
    return { provider: "gemini", model: "gemini-2.5-flash" };
  }

  // Tier mapping for GPT-default routing
  if (m.includes("lite") || m.includes("nano")) {
    return { provider: "gpt", model: "gpt-4o-mini" };
  }
  if (m.includes("flash") && !m.includes("pro")) {
    return { provider: "gpt", model: "gpt-4o-mini" };
  }
  if (m.includes("pro")) {
    return { provider: "gpt", model: "gpt-4o" };
  }

  // Default
  return { provider: "gpt", model: "gpt-4o-mini" };
}
