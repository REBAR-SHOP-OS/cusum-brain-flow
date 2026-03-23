/**
 * OpenAI provider adapter — mirrors existing GPT fetch pattern from aiRouter.
 * Phase 1: standalone, NOT wired into callAI() yet.
 */

import type { LLMProvider, ChatOptions, ChatResult, HealthResult, CostEstimate, TokenUsage } from "./LLMProvider.ts";

const GPT_BASE = "https://api.openai.com/v1/chat/completions";

// Approximate pricing per 1M tokens (USD) — will move to DB table in Phase 3
const PRICING: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o": { prompt: 2.5, completion: 10 },
  "gpt-4o-mini": { prompt: 0.15, completion: 0.6 },
  "gpt-5": { prompt: 10, completion: 30 },
  default: { prompt: 5, completion: 15 },
};

export class OpenAIAdapter implements LLMProvider {
  readonly name = "openai";

  private getKey(): string {
    const key = Deno.env.get("GPT_API_KEY");
    if (!key) throw new Error("GPT_API_KEY not configured");
    return key;
  }

  async chat(opts: ChatOptions): Promise<ChatResult> {
    const apiKey = this.getKey();
    const isGpt5 = opts.model.startsWith("gpt-5");

    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages,
      temperature: isGpt5 ? 1 : (opts.temperature ?? 0.5),
    };

    if (opts.maxTokens) {
      body[isGpt5 ? "max_completion_tokens" : "max_tokens"] = opts.maxTokens;
    }
    if (opts.tools?.length) body.tools = opts.tools;
    if (opts.toolChoice) body.tool_choice = opts.toolChoice;

    const response = await fetch(GPT_BASE, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} — ${errText}`);
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
      const res = await fetch("https://api.openai.com/v1/models", {
        method: "HEAD",
        headers: { Authorization: `Bearer ${apiKey}` },
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
