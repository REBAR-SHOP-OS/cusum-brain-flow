/**
 * Provider abstraction interface for LLM providers.
 * Phase 1: Interface only — not wired into callAI() yet.
 */

export interface ChatOptions {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    tool_call_id?: string;
    tool_calls?: unknown[];
  }>;
  maxTokens?: number;
  temperature?: number;
  tools?: unknown[];
  toolChoice?: unknown;
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  toolCalls: any[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  raw: any;
}

export interface HealthResult {
  ok: boolean;
  latency_ms: number;
  status: number;
}

export interface CostEstimate {
  prompt_cost: number;
  completion_cost: number;
  total_cost: number;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

export interface LLMProvider {
  readonly name: string;
  chat(opts: ChatOptions): Promise<ChatResult>;
  health(): Promise<HealthResult>;
  estimateCost(usage: TokenUsage): CostEstimate;
}
