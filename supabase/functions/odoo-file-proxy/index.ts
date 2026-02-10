import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getOdooFileUrl(): Promise<{ url: string; apiKey: string; login: string; db: string }> {
  const rawUrl = Deno.env.get("ODOO_URL")!;
  const url = new URL(rawUrl.trim()).origin;
  const db = Deno.env.get("ODOO_DATABASE")!;
  const login = Deno.env.get("ODOO_USERNAME")!;
  const apiKey = Deno.env.get("ODOO_API_KEY")!;
  return { url, apiKey, login, db };
}

async function fetchOdooFileViaJsonRpc(
  odoo: { url: string; apiKey: string; login: string; db: string },
  attachmentId: string,
): Promise<{ base64: string; fileName: string; mimeType: string }> {
  // Use JSON-RPC to read ir.attachment fields directly
  const res = await fetch(`${odoo.url}/jsonrpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${odoo.apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: Date.now(),
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          odoo.db,
          2, // uid placeholder, API key auth ignores this
          odoo.apiKey,
          "ir.attachment",
          "read",
          [[parseInt(attachmentId)]],
          { fields: ["datas", "name", "mimetype"] },
        ],
      },
    }),
  });

  const json = await res.json();
  const record = json?.result?.[0];
  if (!record || !record.datas) {
    throw new Error(`Attachment ${attachmentId} not found or has no data`);
  }

  return {
    base64: record.datas,
    fileName: record.name || `file-${attachmentId}`,
    mimeType: record.mimetype || "application/octet-stream",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    if (!odooId) {
      return new Response(JSON.stringify({ error: "Missing id parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch file data via JSON-RPC (reads base64 from ir.attachment)
    const odoo = await getOdooFileUrl();
    const file = await fetchOdooFileViaJsonRpc(odoo, odooId);

    // Decode base64 to binary
    const binaryStr = atob(file.base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
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
