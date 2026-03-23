/**
 * Shared AI Router — routes requests to GPT (OpenAI) or Gemini (Google) directly.
 * Eliminates Lovable AI gateway dependency.
 */

import { isEnabled } from "./featureFlags.ts";
import { resolvePolicy } from "./providers/policyRouter.ts";

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
  let provider = opts.provider || "gpt";
  let model = opts.model || "gpt-4o";
  const maxRetries = 3;
  const requestId = crypto.randomUUID().slice(0, 12);
  const callStart = performance.now();

  // Phase 2: Policy-driven routing (shadow + canary)
  if (isEnabled("ENABLE_POLICY_ROUTER_SHADOW") || isEnabled("USE_POLICY_ROUTER")) {
    try {
      const policyResult = await resolvePolicy(
        opts.agentName || "",
        typeof opts.messages?.[opts.messages.length - 1]?.content === "string"
          ? (opts.messages[opts.messages.length - 1].content as string)
          : "",
        false,
      );
      const isMismatch = policyResult.provider !== provider || policyResult.model !== model;

      // Shadow logging — log what policy would choose vs actual
      if (isEnabled("ENABLE_POLICY_ROUTER_SHADOW")) {
        _logExecution(
          requestId, policyResult.provider, policyResult.model,
          isMismatch ? "shadow-mismatch" : "shadow-match",
          undefined, opts, 0,
          `shadow:${policyResult.source}:${policyResult.reason}`,
          isMismatch ? `actual=${provider}/${model} recommended=${policyResult.provider}/${policyResult.model}` : undefined,
        ).catch(() => {});
      }

      // Canary activation — actually use policy result
      if (isEnabled("USE_POLICY_ROUTER") && policyResult.source === "policy") {
        provider = policyResult.provider;
        model = policyResult.model;
        if (policyResult.maxTokens) opts.maxTokens = opts.maxTokens || policyResult.maxTokens;
        if (policyResult.temperature !== undefined) opts.temperature = opts.temperature ?? policyResult.temperature;
      }
    } catch {
      // Policy resolution failed — continue with original provider/model
    }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await _callAISingle(provider, model, opts);
      // Shadow telemetry — fire-and-forget, flag-gated
      _logExecution(requestId, provider, model, "success", result.raw?.usage, opts, Math.round(performance.now() - callStart), attempt === 0 ? "primary" : `retry-${attempt}`).catch(() => {});
      return result;
    } catch (e) {
      if (e instanceof AIError) {
        if ((e.status === 503 || e.status === 504) && attempt < maxRetries) {
          const delay = 1000 * Math.pow(2, attempt);
          console.warn(`AI ${model} returned ${e.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if ((e.status === 429 || e.status === 503 || e.status === 504) && opts.fallback) {
          console.warn(`AI ${model} error ${e.status}, falling back to ${opts.fallback.model}`);
          _logExecution(requestId, provider, model, "error", undefined, opts, Math.round(performance.now() - callStart), `error-${e.status}`, e.message, e.status).catch(() => {});
          const fallbackStart = performance.now();
          const result = await _callAISingle(opts.fallback.provider, opts.fallback.model, opts);
          _logExecution(requestId, opts.fallback.provider, opts.fallback.model, "fallback", result.raw?.usage, opts, Math.round(performance.now() - fallbackStart), "fallback").catch(() => {});
          return result;
        }
      }
      _logExecution(requestId, provider, model, "error", undefined, opts, Math.round(performance.now() - callStart), `error-final`, e instanceof Error ? e.message : String(e), e instanceof AIError ? e.status : undefined).catch(() => {});
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

  // GPT-5 only supports temperature=1.0
  if (model.startsWith("gpt-5")) {
    body.temperature = 1;
  }

  if (opts.maxTokens) {
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

async function _logExecution(
  requestId: string,
  provider: AIProvider,
  model: string,
  status: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  opts: AIRequestOptions,
  latencyMs: number,
  executionPath: string,
  errorMessage?: string,
  httpStatus?: number,
) {
  // Feature-flag gated — default OFF
  const raw = Deno.env.get("ENABLE_AI_OBSERVABILITY");
  if (!raw || !["true", "1", "yes", "on"].includes(raw.trim().toLowerCase())) return;

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return;

  await fetch(`${url}/rest/v1/ai_execution_log`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      request_id: requestId,
      provider,
      model,
      agent_name: opts.agentName || null,
      company_id: opts.companyId || null,
      user_id: opts.userId || null,
      status,
      http_status: httpStatus || null,
      latency_ms: latencyMs,
      prompt_tokens: usage?.prompt_tokens || 0,
      completion_tokens: usage?.completion_tokens || 0,
      total_tokens: usage?.total_tokens || 0,
      execution_path: executionPath,
      error_message: errorMessage || null,
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
