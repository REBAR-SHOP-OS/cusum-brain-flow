import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireAuth, corsHeaders, json } from "../_shared/auth.ts";
import { SUPER_ADMIN_EMAILS } from "../_shared/accessPolicies.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, serviceClient } = await requireAuth(req);

    // Super admin gate — email check
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();

    const email = (profile?.email ?? "").toLowerCase();
    if (!SUPER_ADMIN_EMAILS.includes(email)) {
      return json({ error: "Forbidden: super admin only" }, 403);
    }

    // 1. Environment presence (booleans only)
    const env_present = {
      gpt: !!Deno.env.get("GPT_API_KEY"),
      gemini: !!Deno.env.get("GEMINI_API_KEY"),
      lovable: !!Deno.env.get("LOVABLE_API_KEY"),
    };

    // 2. OpenAI ping
    const openai_ping = await pingEndpoint(
      "https://api.openai.com/v1/models",
      { Authorization: `Bearer ${Deno.env.get("GPT_API_KEY")}` },
      "HEAD"
    );

    // 3. Gemini ping
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const gemini_ping = await pingEndpoint(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
      {},
      "GET"
    );

    // 4. Lovable gateway ping
    const lovable_ping = await pingEndpoint(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      "POST",
      JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      })
    );

    return json({
      timestamp: new Date().toISOString(),
      env_present,
      openai_ping,
      gemini_ping,
      lovable_ping,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("ai-health error:", e);
    return json({ error: "Internal error" }, 500);
  }
});

async function pingEndpoint(
  url: string,
  headers: Record<string, string>,
  method: string,
  body?: string
): Promise<{ status: number; latency_ms: number; ok: boolean }> {
  const start = performance.now();
  try {
    const resp = await fetch(url, {
      method,
      headers,
      ...(body ? { body } : {}),
    });
    const latency_ms = Math.round(performance.now() - start);
    return { status: resp.status, latency_ms, ok: resp.ok };
  } catch (e) {
    const latency_ms = Math.round(performance.now() - start);
    return { status: 0, latency_ms, ok: false };
  }
}
