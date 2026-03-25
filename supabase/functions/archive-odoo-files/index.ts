import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleRequest } from "../_shared/requestHandler.ts";
import { isOdooEnabled } from "../_shared/featureFlags.ts";

const TIME_LIMIT_MS = 45_000;
const BATCH_SIZE = 5;
const BUCKET = "estimation-files";

async function fetchOdooFile(
  odoo: { url: string; apiKey: string; db: string },
  attachmentId: number,
): Promise<{ bytes: Uint8Array; fileName: string; mimeType: string }> {
  const res = await fetch(`${odoo.url}/jsonrpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${odoo.apiKey}`,
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
          2,
          odoo.apiKey,
          "ir.attachment",
          "read",
          [[attachmentId]],
          { fields: ["datas", "name", "mimetype"] },
        ],
      },
    }),
  });

  const json = await res.json();
  const record = json?.result?.[0];
  if (!record || !record.datas) {
    throw new Error(`Attachment ${attachmentId} not found or empty`);
  }

  const binaryStr = atob(record.datas);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return {
    bytes,
    fileName: record.name || `file-${attachmentId}`,
    mimeType: record.mimetype || "application/octet-stream",
  };
}

/** Insert a row into migration_logs */
async function logMigrationRun(
  supabaseAdmin: ReturnType<typeof createClient>,
  data: {
    migrated: number;
    failed: number;
    remaining: number;
    elapsed_s: number;
    errors: string[];
    status: string;
  },
) {
  try {
    await supabaseAdmin.from("migration_logs").insert({
      migrated: data.migrated,
      failed: data.failed,
      remaining: data.remaining,
      elapsed_s: data.elapsed_s,
      errors: data.errors.slice(0, 20),
      status: data.status,
    });
  } catch (e) {
    console.error("Failed to write migration_log:", e);
  }
}

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient: supabaseAdmin, userId, req: rawReq }) => {
    const startTime = Date.now();

    // ODOO_ENABLED feature flag guard
    if (!isOdooEnabled()) {
      console.warn("ODOO_ENABLED guard: flag resolved to false");
      return { error: "Odoo integration is disabled. File migration paused.", disabled: true };
    }

    // Dual-auth: allow service_role (cron) OR authenticated user
    // handleRequest with authMode "optional" gives us userId if JWT present.
    // Also allow service_role key calls (from cron).
    const authHeader = rawReq.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRole = token === serviceKey;

    if (!userId && !isServiceRole) {
      await logMigrationRun(supabaseAdmin, {
        migrated: 0, failed: 0, remaining: -1,
        elapsed_s: 0, errors: ["No Authorization header"], status: "auth_error",
      });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }

    const rawUrl = Deno.env.get("ODOO_URL")!;
    const odoo = {
      url: new URL(rawUrl.trim()).origin,
      db: Deno.env.get("ODOO_DATABASE")!,
      apiKey: Deno.env.get("ODOO_API_KEY")!,
    };

    // Find lead_files that still need migration
    const { data: pendingFiles, error: queryErr } = await supabaseAdmin
      .from("lead_files")
      .select("id, odoo_id, file_name, lead_id")
      .not("odoo_id", "is", null)
      .is("storage_path", null)
      .limit(BATCH_SIZE);

    if (queryErr) throw queryErr;
    if (!pendingFiles || pendingFiles.length === 0) {
      await logMigrationRun(supabaseAdmin, {
        migrated: 0, failed: 0, remaining: 0,
        elapsed_s: parseFloat(((Date.now() - startTime) / 1000).toFixed(1)),
        errors: [], status: "success",
      });
      return { migrated: 0, remaining: 0, message: "All files already migrated" };
    }

    let migrated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const file of pendingFiles) {
      if (Date.now() - startTime > TIME_LIMIT_MS) break;

      try {
        const odooId = parseInt(String(file.odoo_id));
        if (isNaN(odooId)) { failed++; continue; }

        const result = await fetchOdooFile(odoo, odooId);
        const safeName = result.fileName.replace(/[~#%&{}\\<>*?/$!'":@+`|=]/g, "_");
        const storagePath = `odoo-archive/${file.lead_id}/${file.odoo_id}-${safeName}`;

        const { error: uploadErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(storagePath, result.bytes, {
            contentType: result.mimeType,
            upsert: true,
          });

        if (uploadErr) { failed++; errors.push(`Upload ${file.odoo_id}: ${uploadErr.message}`); continue; }

        const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);

        const { error: updateErr } = await supabaseAdmin
          .from("lead_files")
          .update({ storage_path: storagePath, file_url: urlData.publicUrl || storagePath })
          .eq("id", file.id);

        if (updateErr) { failed++; errors.push(`Update ${file.id}: ${updateErr.message}`); continue; }

        migrated++;
      } catch (err) {
        failed++;
        errors.push(`File ${file.odoo_id}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    // Count remaining
    const { count } = await supabaseAdmin
      .from("lead_files")
      .select("id", { count: "exact", head: true })
      .not("odoo_id", "is", null)
      .is("storage_path", null);

    const elapsed = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
    const remaining = (count ?? 0);
    console.log(`archive-odoo-files: ${migrated} migrated, ${failed} failed, ${remaining} remaining in ${elapsed}s`);

    await logMigrationRun(supabaseAdmin, {
      migrated, failed, remaining, elapsed_s: elapsed,
      errors, status: failed > 0 ? "error" : "success",
    });

    return { migrated, failed, remaining, elapsed_s: elapsed, errors: errors.slice(0, 10) };
  }, { functionName: "archive-odoo-files", authMode: "optional", requireCompany: false, wrapResult: false })
);
