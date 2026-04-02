import { handleRequest } from "../_shared/requestHandler.ts";
import { isOdooEnabled } from "../_shared/featureFlags.ts";

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

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    // ODOO_ENABLED feature flag guard
    if (!isOdooEnabled()) {
      console.warn("ODOO_ENABLED guard: flag resolved to false");
      return new Response(JSON.stringify({ error: "Odoo integration is disabled", disabled: true }), {
        status: 410, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const url = new URL(req.url);
    const odooId = url.searchParams.get("id");
    const odooUrl = url.searchParams.get("url");
    const hasUrlModeEnabled = Deno.env.get("ODOO_PROXY_ALLOW_URL_MODE") === "true";

    if (!odooId && !odooUrl) {
      return new Response(JSON.stringify({ error: "Missing id or url parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const odoo = await getOdooFileUrl();

    // URL-based proxy (disabled by default; id-based attachment mode is safer)
    if (odooUrl) {
      if (!hasUrlModeEnabled) {
        return new Response(JSON.stringify({ error: "URL proxy mode is disabled" }), {
          status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
      const parsedUrl = new URL(odooUrl);
      const odooOrigin = new URL(odoo.url).origin;
      if (!parsedUrl.pathname.startsWith("/web/content/")) {
        return new Response(JSON.stringify({ error: "Only /web/content/* URLs are allowed" }), {
          status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
      if (parsedUrl.origin !== odooOrigin) {
        return new Response(JSON.stringify({ error: "URL must point to configured Odoo instance" }), {
          status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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
          status: proxyRes.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      const contentType = proxyRes.headers.get("content-type") || "application/octet-stream";
      const body = await proxyRes.arrayBuffer();
      return new Response(body, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // ID-based proxy
    const [meta, bytes] = await Promise.all([
      fetchOdooFileMeta(odoo, odooId!),
      fetchOdooFileBinary(odoo, odooId!),
    ]);

    return new Response(bytes, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": meta.mimeType,
        "Content-Disposition": `attachment; filename="${meta.fileName}"`,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }, { functionName: "odoo-file-proxy", requireCompany: false, wrapResult: false })
);
