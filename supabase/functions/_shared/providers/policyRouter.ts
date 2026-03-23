/**
 * Policy-driven AI routing engine.
 * Reads llm_routing_policy table, matches first rule by priority.
 * Falls back to hardcoded selectModel() if no match or fetch fails.
 * Cached in-memory for 60s to avoid per-call DB reads.
 */

import { cacheGet, cacheSet } from "../cache.ts";
import { selectModel, type AIProvider } from "../aiRouter.ts";

const CACHE_KEY = "llm_routing_policies";
const CACHE_TTL = 60_000; // 60 seconds

interface RoutingPolicy {
  agent_name: string | null;
  message_pattern: string | null;
  has_attachments: boolean | null;
  provider: string;
  model: string;
  max_tokens: number;
  temperature: number;
  priority: number;
  reason: string | null;
}

export interface PolicyResult {
  provider: AIProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  reason: string;
  source: "policy" | "fallback";
}

const HEALTH_CACHE_KEY = "llm_provider_health";
const HEALTH_CACHE_TTL = 30_000; // 30 seconds

interface ProviderHealth {
  provider: string;
  is_healthy: boolean;
}

async function fetchHealthyProviders(): Promise<Set<string>> {
  const cached = cacheGet<Set<string>>(HEALTH_CACHE_KEY);
  if (cached) return cached;

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return new Set(); // empty = don't filter

  try {
    const resp = await fetch(
      `${url}/rest/v1/llm_provider_configs?select=provider,is_healthy`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!resp.ok) return new Set();
    const data = (await resp.json()) as ProviderHealth[];
    const healthy = new Set(data.filter((p) => p.is_healthy !== false).map((p) => p.provider));
    cacheSet(HEALTH_CACHE_KEY, healthy, HEALTH_CACHE_TTL);
    return healthy;
  } catch {
    return new Set();
  }
}

async function fetchPolicies(): Promise<RoutingPolicy[]> {
  const cached = cacheGet<RoutingPolicy[]>(CACHE_KEY);
  if (cached) return cached;

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return [];

  try {
    const resp = await fetch(
      `${url}/rest/v1/llm_routing_policy?is_active=eq.true&order=priority.asc`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    cacheSet(CACHE_KEY, data, CACHE_TTL);
    return data as RoutingPolicy[];
  } catch {
    return [];
  }
}

function matchesPolicy(
  policy: RoutingPolicy,
  agent: string,
  message: string,
  hasAttachments: boolean,
): boolean {
  // Agent name match (null = wildcard)
  if (policy.agent_name && policy.agent_name !== agent) return false;

  // Attachments match (null = don't care)
  if (policy.has_attachments !== null && policy.has_attachments !== hasAttachments) return false;

  // Message pattern match (null = wildcard)
  if (policy.message_pattern) {
    try {
      const regex = new RegExp(policy.message_pattern, "i");
      if (!regex.test(message)) return false;
    } catch {
      return false; // invalid regex → skip rule
    }
  }

  return true;
}

/**
 * Resolve the best provider/model based on routing policies.
 * Falls back to hardcoded selectModel() if no policy matches or fetch fails.
 */
export async function resolvePolicy(
  agent: string,
  message: string,
  hasAttachments: boolean,
  historyLength = 0,
): Promise<PolicyResult> {
  try {
    const policies = await fetchPolicies();

    for (const policy of policies) {
      if (matchesPolicy(policy, agent, message, hasAttachments)) {
        return {
          provider: policy.provider as AIProvider,
          model: policy.model,
          maxTokens: policy.max_tokens,
          temperature: policy.temperature,
          reason: policy.reason || "policy match",
          source: "policy",
        };
      }
    }
  } catch {
    // Fetch failed — fall through to hardcoded
  }

  // Fallback to hardcoded selectModel()
  const fallback = selectModel(agent, message, hasAttachments, historyLength);
  return {
    provider: fallback.provider,
    model: fallback.model,
    maxTokens: fallback.maxTokens,
    temperature: fallback.temperature,
    reason: fallback.reason,
    source: "fallback",
  };
}
