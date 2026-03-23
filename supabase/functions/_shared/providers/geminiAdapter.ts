/**
 * Gemini provider adapter — mirrors existing Gemini fetch pattern from aiRouter.
 * Phase 1: standalone, NOT wired into callAI() yet.
 */

import type { LLMProvider, ChatOptions, ChatResult, HealthResult, CostEstimate, TokenUsage } from "./LLMProvider.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

// Approximate pricing per 1M tokens (USD) — will move to DB table in Phase 3
const PRICING: Record<string, { prompt: number; completion: number }> = {
  "gemini-2.5-pro": { prompt: 1.25, completion: 10 },
  "gemini-2.5-flash": { prompt: 0.15, completion: 0.6 },
  default: { prompt: 0.5, completion: 2 },
};

export class GeminiAdapter implements LLMProvider {
  readonly name = "gemini";

  private getKey(): string {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY not configured");
    return key;
  }

  async chat(opts: ChatOptions): Promise<ChatResult> {
    const apiKey = this.getKey();

    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.5,
    };

    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    if (opts.tools?.length) body.tools = opts.tools;
    if (opts.toolChoice) body.tool_choice = opts.toolChoice;

    const response = await fetch(GEMINI_BASE, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} — ${errText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || "",
      toolCalls: choice?.message?.tool_calls || [],
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
      },
      raw: data,
    };
  }

  async health(): Promise<HealthResult> {
    const apiKey = this.getKey();
    const start = performance.now();
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        method: "GET",
      });
      return { ok: res.ok, latency_ms: Math.round(performance.now() - start), status: res.status };
    } catch {
      return { ok: false, latency_ms: Math.round(performance.now() - start), status: 0 };
    }
  }

  estimateCost(usage: TokenUsage): CostEstimate {
    const rates = PRICING.default;
    const prompt_cost = (usage.prompt_tokens / 1_000_000) * rates.prompt;
    const completion_cost = (usage.completion_tokens / 1_000_000) * rates.completion;
    return { prompt_cost, completion_cost, total_cost: prompt_cost + completion_cost };
  }
}
