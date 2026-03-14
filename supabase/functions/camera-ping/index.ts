import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuth(req);
  } catch (r) {
    if (r instanceof Response) return r;
    return json({ error: "Auth failed" }, 401);
  }

  try {
    const { ip_address, port } = await req.json();
    if (!ip_address) return json({ error: "ip_address required" }, 400);

    const rtspPort = port ?? 554;
    const results: { http?: boolean; rtsp?: boolean; latency_ms?: number; error?: string } = {};

    // Try HTTP ping (port 80) — most Reolink cameras serve a web UI
    const httpStart = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`http://${ip_address}/`, { signal: controller.signal });
      clearTimeout(timer);
      await resp.text(); // consume body
      results.http = true;
      results.latency_ms = Date.now() - httpStart;
    } catch {
      results.http = false;
      results.latency_ms = Date.now() - httpStart;
    }

    // Try RTSP port via Deno.connect (TCP check)
    const tcpStart = Date.now();
    try {
      const conn = await Deno.connect({ hostname: ip_address, port: rtspPort });
      conn.close();
      results.rtsp = true;
      if (!results.http) results.latency_ms = Date.now() - tcpStart;
    } catch {
      results.rtsp = false;
    }

    const reachable = results.http === true || results.rtsp === true;

    return json({
      reachable,
      http_reachable: results.http ?? false,
      rtsp_reachable: results.rtsp ?? false,
      latency_ms: results.latency_ms ?? null,
      error: reachable ? undefined : "Camera not reachable on HTTP or RTSP",
    });
  } catch (err) {
    console.error("camera-ping error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
