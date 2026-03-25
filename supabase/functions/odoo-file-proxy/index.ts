import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isOdooEnabled } from "../_shared/featureFlags.ts";

import { corsHeaders } from "../_shared/auth.ts";

async function getOdooFileUrl(): Promise<{ url: string; apiKey: string; login: string; db: string }> {
  const rawUrl = Deno.env.get("ODOO_URL")!;
  const url = new URL(rawUrl.trim()).origin;
  const db = Deno.env.get("ODOO_DATABASE")!;
  const login = Deno.env.get("ODOO_USERNAME")!;
  const apiKey = Deno.env.get("ODOO_API_KEY")!;
  return { url, apiKey, login, db };
}

async function fetchOdooFileMeta(
  odoo: { url: string; apiKey: string; login: string; db: string },
  attachmentId: string,
): Promise<{ fileName: string; mimeType: string }> {
  const res = await fetch(`${odoo.url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${odoo.apiKey}` },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "call", id: Date.now(),
      params: {
        service: "object", method: "execute_kw",
        args: [odoo.db, 2, odoo.apiKey, "ir.attachment", "read",
          [[parseInt(attachmentId)]], { fields: ["name", "mimetype"] }],
      },
    }),
  });
  const json = await res.json();
  const record = json?.result?.[0];
  if (!record) throw new Error(`Attachment ${attachmentId} not found`);
  return {
    fileName: record.name || `file-${attachmentId}`,
    mimeType: record.mimetype || "application/octet-stream",
  };
}

async function fetchOdooFileBinary(
  odoo: { url: string; apiKey: string; login: string; db: string },
  attachmentId: string,
): Promise<Uint8Array> {
  // Use JSON-RPC to read base64 data — works reliably with API key auth
  const res = await fetch(`${odoo.url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${odoo.apiKey}` },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "call", id: Date.now(),
      params: {
        service: "object", method: "execute_kw",
        args: [odoo.db, 2, odoo.apiKey, "ir.attachment", "read",
          [[parseInt(attachmentId)]], { fields: ["datas"] }],
      },
    }),
  });
  const json = await res.json();
  const record = json?.result?.[0];
  if (!record || !record.datas) throw new Error(`Attachment ${attachmentId} not found or empty`);

  const binaryStr = atob(record.datas);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ODOO_ENABLED feature flag guard
  if (!isOdooEnabled()) {
    console.warn("ODOO_ENABLED guard: flag resolved to false");
    return new Response(JSON.stringify({ error: "Odoo integration is disabled", disabled: true }), {
      status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const odooId = url.searchParams.get("id");
    const odooUrl = url.searchParams.get("url");

    if (!odooId && !odooUrl) {
      return new Response(JSON.stringify({ error: "Missing id or url parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const odoo = await getOdooFileUrl();

    // URL-based proxy: fetch an arbitrary Odoo URL with auth (for inline email images)
    if (odooUrl) {
      // Validate the URL points to the configured Odoo instance
      const parsedUrl = new URL(odooUrl);
      const odooOrigin = new URL(odoo.url).origin;
      if (parsedUrl.origin !== odooOrigin) {
        return new Response(JSON.stringify({ error: "URL must point to configured Odoo instance" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const proxyRes = await fetch(odooUrl, {
        headers: {
          "Cookie": `session_id=`,
          "Authorization": `Bearer ${odoo.apiKey}`,
        },
      });

      if (!proxyRes.ok) {
        return new Response(JSON.stringify({ error: `Odoo returned ${proxyRes.status}` }), {
          status: proxyRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const contentType = proxyRes.headers.get("content-type") || "application/octet-stream";
      const body = await proxyRes.arrayBuffer();
      return new Response(body, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // ID-based proxy: fetch attachment by Odoo attachment ID
    const [meta, bytes] = await Promise.all([
      fetchOdooFileMeta(odoo, odooId!),
      fetchOdooFileBinary(odoo, odooId!),
    ]);

    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": meta.mimeType,
        "Content-Disposition": `attachment; filename="${meta.fileName}"`,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("odoo-file-proxy error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
