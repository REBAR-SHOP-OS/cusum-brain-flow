import { handleRequest } from "../_shared/requestHandler.ts";

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

    return result;
  }, { functionName: "wp-test", authMode: "required", requireCompany: false, wrapResult: false })
);
