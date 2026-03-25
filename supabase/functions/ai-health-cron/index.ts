import { handleRequest } from "../_shared/requestHandler.ts";

/**
 * Scheduled health checker for AI providers.
 * Pings OpenAI + Gemini, updates llm_provider_configs with health status.
 * Intended to be called by pg_cron every 5 minutes.
 */
Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient }) => {
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
        await serviceClient
          .from("llm_provider_configs")
          .update({
            is_healthy: health.ok,
            last_health_check: now,
            last_latency_ms: health.latency_ms,
          })
          .eq("provider", provider);
      } catch (e) {
        console.warn(`[ai-health-cron] Failed to update ${provider}:`, e);
      }
    }

    return { timestamp: now, results };
  }, { functionName: "ai-health-cron", requireCompany: false, wrapResult: false })
);
