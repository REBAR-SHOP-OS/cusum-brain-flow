import { handleRequest } from "../_shared/requestHandler.ts";

/**
 * Camera ping — checks HTTP and RTSP reachability of a camera IP.
 * Migrated to shared handleRequest wrapper for consistent auth/error handling.
 * No company scope needed — just auth.
 */
Deno.serve(async (req) =>
  handleRequest(req, async (ctx) => {
    const { ip_address, port } = ctx.body;
    if (!ip_address) {
      throw new Response(
        JSON.stringify({ ok: false, error: "ip_address required" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version" } },
      );
    }

    const rtspPort = port ?? 554;
    const results: { http?: boolean; rtsp?: boolean; latency_ms?: number } = {};

    // Try HTTP ping (port 80)
    const httpStart = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`http://${ip_address}/`, { signal: controller.signal });
      clearTimeout(timer);
      await resp.text();
      results.http = true;
      results.latency_ms = Date.now() - httpStart;
    } catch {
      results.http = false;
      results.latency_ms = Date.now() - httpStart;
    }

    // Try RTSP port via TCP check
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

    return {
      reachable,
      http_reachable: results.http ?? false,
      rtsp_reachable: results.rtsp ?? false,
      latency_ms: results.latency_ms ?? null,
      error: reachable ? undefined : "Camera not reachable on HTTP or RTSP",
    };
  }, { functionName: "camera-ping", requireCompany: false })
);
