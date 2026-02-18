import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TABLES_TO_BACKUP = [
  "leads",
  "orders",
  "profiles",
  "contacts",
  "customers",
  "projects",
  "project_tasks",
  "order_items",
  "work_orders",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ---------- Auth ----------
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } =
    await userClient.auth.getClaims(token);

  if (claimsError || !claimsData?.claims?.sub) {
    return json({ error: "Invalid token" }, 401);
  }

  const userId = claimsData.claims.sub as string;
  const serviceClient = createClient(supabaseUrl, serviceKey);

  // ---------- Admin check ----------
  const { data: roleRows } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const isAdmin = roleRows?.some((r) => r.role === "admin");

  // Allow scheduled calls (no user = service-role context) — identified by backup_type=scheduled
  let requestBody: Record<string, unknown> = {};
  try {
    requestBody = await req.json();
  } catch {
    // ignore parse errors for list with no body
  }

  const isScheduled = requestBody.backup_type === "scheduled";

  if (!isAdmin && !isScheduled) {
    return json({ error: "Forbidden: admin access required" }, 403);
  }

  const action = requestBody.action as string;

  // ---------- GET profile info ----------
  let creatorName = "System";
  if (userId) {
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("full_name, company_id")
      .eq("user_id", userId)
      .single();
    creatorName = profile?.full_name ?? "Admin";
  }

  const { data: profileData } = await serviceClient
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();
  const companyId =
    profileData?.company_id ?? "a0000000-0000-0000-0000-000000000001";

  // ==========================================================
  // ACTION: list
  // ==========================================================
  if (action === "list") {
    const { data, error } = await serviceClient
      .from("system_backups")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);

    if (error) return json({ error: error.message }, 500);
    return json({ backups: data });
  }

  // ==========================================================
  // ACTION: run (create backup)
  // ==========================================================
  if (action === "run") {
    // Throttle: max 1 backup per 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recent } = await serviceClient
      .from("system_backups")
      .select("id, started_at")
      .gte("started_at", fiveMinAgo)
      .in("status", ["pending", "running", "success"])
      .limit(1);

    if (recent && recent.length > 0) {
      return json({ error: "Throttled: a backup was already run recently. Wait 5 minutes." }, 429);
    }

    // Insert pending row
    const { data: backupRow, error: insertErr } = await serviceClient
      .from("system_backups")
      .insert({
        company_id: companyId,
        created_by: userId || null,
        created_by_name: creatorName,
        status: "running",
        backup_type: isScheduled ? "scheduled" : "manual",
        started_at: new Date().toISOString(),
        tables_backed_up: TABLES_TO_BACKUP,
      })
      .select()
      .single();

    if (insertErr || !backupRow) {
      return json({ error: "Failed to create backup record: " + insertErr?.message }, 500);
    }

    const backupId = backupRow.id;

    try {
      // Collect data from all tables
      const snapshot: Record<string, unknown[]> = {};
      for (const table of TABLES_TO_BACKUP) {
        const { data: rows, error: tableErr } = await serviceClient
          .from(table)
          .select("*")
          .limit(10000);
        if (tableErr) {
          console.warn(`Warning: could not back up table ${table}: ${tableErr.message}`);
          snapshot[table] = [];
        } else {
          snapshot[table] = rows ?? [];
        }
      }

      const snapshotJson = JSON.stringify({
        version: "1.0",
        created_at: new Date().toISOString(),
        backup_id: backupId,
        tables: snapshot,
      });

      const filePath = `backups/${backupId}.json`;
      const fileBytes = new TextEncoder().encode(snapshotJson);

      // Upload to storage
      const { error: uploadErr } = await serviceClient.storage
        .from("system-backups")
        .upload(filePath, fileBytes, {
          contentType: "application/json",
          upsert: true,
        });

      if (uploadErr) {
        await serviceClient.from("system_backups").update({
          status: "failed",
          error_message: uploadErr.message,
          completed_at: new Date().toISOString(),
        }).eq("id", backupId);

        return json({ error: "Storage upload failed: " + uploadErr.message }, 500);
      }

      // Mark success
      await serviceClient.from("system_backups").update({
        status: "success",
        file_path: filePath,
        file_size_bytes: fileBytes.byteLength,
        completed_at: new Date().toISOString(),
      }).eq("id", backupId);

      // Log
      await serviceClient.from("backup_restore_logs").insert({
        backup_id: backupId,
        performed_by: userId || null,
        performed_by_name: creatorName,
        action: "backup",
        result: "success",
      });

      return json({ success: true, backup_id: backupId, file_path: filePath });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await serviceClient.from("system_backups").update({
        status: "failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      }).eq("id", backupId);

      await serviceClient.from("backup_restore_logs").insert({
        backup_id: backupId,
        performed_by: userId || null,
        performed_by_name: creatorName,
        action: "backup",
        result: "failed",
        error_message: msg,
      });

      return json({ error: msg }, 500);
    }
  }

  // ==========================================================
  // ACTION: restore
  // ==========================================================
  if (action === "restore") {
    const backupId = requestBody.backup_id as string;
    const confirm = requestBody.confirm as string;

    if (!backupId) return json({ error: "backup_id is required" }, 400);
    if (confirm !== "RESTORE") {
      return json({ error: 'Confirmation string must be exactly "RESTORE"' }, 400);
    }

    // Fetch backup metadata
    const { data: backup, error: fetchErr } = await serviceClient
      .from("system_backups")
      .select("*")
      .eq("id", backupId)
      .single();

    if (fetchErr || !backup) {
      return json({ error: "Backup not found" }, 404);
    }
    if (backup.status !== "success" || !backup.file_path) {
      return json({ error: "Backup is not in a restorable state" }, 400);
    }

    try {
      // Download JSON snapshot
      const { data: fileData, error: dlErr } = await serviceClient.storage
        .from("system-backups")
        .download(backup.file_path);

      if (dlErr || !fileData) {
        return json({ error: "Could not download backup file: " + dlErr?.message }, 500);
      }

      const snapshotText = await fileData.text();
      const snapshot = JSON.parse(snapshotText) as {
        tables: Record<string, unknown[]>;
      };

      // Upsert each table sequentially
      const errors: string[] = [];
      for (const table of TABLES_TO_BACKUP) {
        const rows = snapshot.tables?.[table];
        if (!rows || rows.length === 0) continue;

        // Upsert in batches of 500
        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const { error: upsertErr } = await serviceClient
            .from(table)
            .upsert(batch as Record<string, unknown>[], {
              onConflict: "id",
              ignoreDuplicates: false,
            });
          if (upsertErr) {
            errors.push(`${table}: ${upsertErr.message}`);
          }
        }
      }

      if (errors.length > 0) {
        const errMsg = errors.join("; ");
        await serviceClient.from("backup_restore_logs").insert({
          backup_id: backupId,
          performed_by: userId || null,
          performed_by_name: creatorName,
          action: "restore",
          result: "failed",
          error_message: errMsg,
        });
        return json({ error: "Partial restore failure: " + errMsg }, 500);
      }

      await serviceClient.from("backup_restore_logs").insert({
        backup_id: backupId,
        performed_by: userId || null,
        performed_by_name: creatorName,
        action: "restore",
        result: "success",
      });

      return json({ success: true, restored_from: backup.file_path });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await serviceClient.from("backup_restore_logs").insert({
        backup_id: backupId,
        performed_by: userId || null,
        performed_by_name: creatorName,
        action: "restore",
        result: "failed",
        error_message: msg,
      });
      return json({ error: msg }, 500);
    }
  }

  return json({ error: "Unknown action. Use: run | restore | list" }, 400);
});
