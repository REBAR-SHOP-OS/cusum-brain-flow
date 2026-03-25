import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import { corsHeaders } from "../_shared/auth.ts";

/**
 * Scheduled health checker for AI providers.
 * Pings OpenAI + Gemini, updates llm_provider_configs with health status.
 * Intended to be called by pg_cron every 5 minutes.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing env" }), { status: 500, headers: corsHeaders });
  }

  const results: Record<string, { ok: boolean; latency_ms: number; status: number }> = {};

  // Ping OpenAI
  const gptKey = Deno.env.get("GPT_API_KEY");
  if (gptKey) {
    const start = performance.now();
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        method: "HEAD",
        headers: { Authorization: `Bearer ${gptKey}` },
      });
      results.gpt = { ok: res.ok, latency_ms: Math.round(performance.now() - start), status: res.status };
    } catch {
      results.gpt = { ok: false, latency_ms: Math.round(performance.now() - start), status: 0 };
    }
  }

  // Ping Gemini
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (geminiKey) {
    const start = performance.now();
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
        { method: "GET" },
      );
      results.gemini = { ok: res.ok, latency_ms: Math.round(performance.now() - start), status: res.status };
    } catch {
      results.gemini = { ok: false, latency_ms: Math.round(performance.now() - start), status: 0 };
    }
  }

  // Update llm_provider_configs with health status
  const now = new Date().toISOString();
  for (const [provider, health] of Object.entries(results)) {
    try {
      await fetch(
        `${url}/rest/v1/llm_provider_configs?provider=eq.${provider}`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            is_healthy: health.ok,
            last_health_check: now,
            last_latency_ms: health.latency_ms,
          }),
        },
      );
    } catch (e) {
      console.warn(`[ai-health-cron] Failed to update ${provider}:`, e);
    }
  }

  console.log(`[ai-health-cron] Health check complete:`, JSON.stringify(results));

  return new Response(JSON.stringify({ timestamp: now, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
