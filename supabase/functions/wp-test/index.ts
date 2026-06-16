import { handleRequest } from "../_shared/requestHandler.ts";

const UA = "Mozilla/5.0 (compatible; RebarShopERP/1.0; +https://erp.rebar.shop)";

async function fetchWithRetry(url: string, init: RequestInit = {}, attempts = 3): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("User-Agent")) headers.set("User-Agent", UA);
  if (!headers.has("Accept")) headers.set("Accept", "application/json, */*;q=0.1");
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, { ...init, headers });
    } catch (err) {
      lastErr = err;
      const msg = String((err as Error)?.message ?? err);
      if (!/tls handshake|connection|eof|reset|timed out/i.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr;
}

Deno.serve((req) =>
  handleRequest(req, async () => {
    const baseUrl = Deno.env.get("WP_BASE_URL");
    const username = Deno.env.get("WP_USERNAME");
    const password = Deno.env.get("WP_APP_PASSWORD");

    if (!baseUrl || !username || !password) throw new Error("Missing WP credentials");

    const creds = btoa(`${username}:${password}`);
    const authHeader = `Basic ${creds}`;
    const result: Record<string, unknown> = { ok: true };

    // --- READ TEST ---
    const readRes = await fetch(`${baseUrl}/posts?per_page=1`, {
      headers: { Authorization: authHeader },
    });
    const readBody = await readRes.text();

    if (!readRes.ok) {
      result.read = { status: "failed", error: `HTTP ${readRes.status}: ${readBody.slice(0, 300)}` };
      result.ok = false;
    } else {
      const posts = JSON.parse(readBody);
      result.read = {
        status: "ok",
        sample_post_id: posts[0]?.id ?? null,
        sample_title: posts[0]?.title?.rendered ?? null,
      };
    }

    // --- WRITE TEST ---
    try {
      const createRes = await fetch(`${baseUrl}/posts`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "WRITE_TEST — delete me", status: "draft" }),
      });
      const createBody = await createRes.text();

      if (!createRes.ok) {
        result.write = { status: "failed", error: `Create failed HTTP ${createRes.status}: ${createBody.slice(0, 300)}` };
        result.ok = false;
      } else {
        const created = JSON.parse(createBody);
        const createdId = created.id;
        const deleteRes = await fetch(`${baseUrl}/posts/${createdId}?force=true`, {
          method: "DELETE",
          headers: { Authorization: authHeader },
        });
        result.write = { status: "ok", created_id: createdId, deleted: deleteRes.ok, delete_status: deleteRes.status };
      }
    } catch (writeErr: any) {
      result.write = { status: "failed", error: writeErr.message };
      result.ok = false;
    }

    // --- WOOCOMMERCE READ + WRITE TEST ---
    const wcKey = Deno.env.get("WC_CONSUMER_KEY");
    const wcSecret = Deno.env.get("WC_CONSUMER_SECRET");
    // baseUrl is /wp-json/wp/v2 — derive site root for /wc/v3
    const siteRoot = baseUrl.replace(/\/wp-json.*$/, "");
    const wcBase = `${siteRoot}/wp-json/wc/v3`;

    if (!wcKey || !wcSecret) {
      result.wc_read = { status: "failed", error: "Missing WC_CONSUMER_KEY/SECRET" };
      result.wc_write = { status: "failed", error: "Missing WC_CONSUMER_KEY/SECRET" };
      result.ok = false;
    } else {
      const wcAuth = `consumer_key=${encodeURIComponent(wcKey)}&consumer_secret=${encodeURIComponent(wcSecret)}`;
      try {
        const wcReadRes = await fetch(`${wcBase}/products?per_page=1&${wcAuth}`);
        const wcReadBody = await wcReadRes.text();
        if (!wcReadRes.ok) {
          result.wc_read = { status: "failed", error: `HTTP ${wcReadRes.status}: ${wcReadBody.slice(0, 300)}` };
          result.ok = false;
        } else {
          const products = JSON.parse(wcReadBody);
          const sample = products[0];
          result.wc_read = { status: "ok", sample_product_id: sample?.id ?? null, sample_name: sample?.name ?? null };

          // Write test: PUT same description back to itself (no-op write)
          if (sample?.id) {
            const original = sample.description ?? "";
            const wcWriteRes = await fetch(`${wcBase}/products/${sample.id}?${wcAuth}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ description: original }),
            });
            const wcWriteBody = await wcWriteRes.text();
            if (!wcWriteRes.ok) {
              result.wc_write = { status: "failed", error: `HTTP ${wcWriteRes.status}: ${wcWriteBody.slice(0, 300)}` };
              result.ok = false;
            } else {
              result.wc_write = { status: "ok", updated_id: sample.id, note: "no-op PUT (description unchanged)" };
            }
          } else {
            result.wc_write = { status: "skipped", error: "no product available to write-test" };
          }
        }
      } catch (wcErr: any) {
        result.wc_read = result.wc_read ?? { status: "failed", error: wcErr.message };
        result.wc_write = result.wc_write ?? { status: "failed", error: wcErr.message };
        result.ok = false;
      }
    }

    return result;
  }, { functionName: "wp-test", authMode: "required", requireCompany: false, wrapResult: false })
);
