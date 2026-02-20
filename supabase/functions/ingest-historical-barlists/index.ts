import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";
import { parseRebarCADRows, summarizeBarlist } from "../_shared/rebarCADParser.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5/xlsx.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "estimation-files";

// Hard limits to prevent WORKER_LIMIT crashes
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — XLSX.read crashes above this
const MAX_FILES_PER_BATCH = 1; // Process exactly 1 file per invocation

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await requireAuth(req);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: profile } = await admin.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
    if (!profile?.company_id) return json({ error: "No company found" }, 400);
    const companyId = profile.company_id;

    const body = await req.json().catch(() => ({}));
    const reset = body.reset ?? false;

    // Get or create progress tracker
    let { data: progress } = await admin
      .from("ingestion_progress")
      .select("*")
      .eq("job_type", "barlists")
      .eq("company_id", companyId)
      .eq("source_type", "xls")
      .maybeSingle();

    if (reset && progress) {
      await admin.from("ingestion_progress").update({
        status: "pending", processed_items: 0, processed_files: 0, failed_items: 0,
        last_processed_lead_id: null, error_log: [], completed_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", progress.id);
      progress.status = "pending";
      progress.processed_items = 0;
      progress.processed_files = 0;
      progress.last_processed_lead_id = null;
    }

    if (!progress) {
      const { count: totalFiles } = await admin
        .from("lead_files")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .not("storage_path", "is", null)
        .or("file_name.ilike.%.xls,file_name.ilike.%.xlsx");

      const { data: inserted } = await admin.from("ingestion_progress").insert({
        job_type: "barlists", company_id: companyId, source_type: "xls",
        total_items: 0, total_files: totalFiles ?? 0,
        status: "running", started_at: new Date().toISOString(),
      }).select().single();
      progress = inserted;
    }

    if (progress.status === "completed") {
      return json({ message: "Barlist ingestion already completed. Use reset=true to re-run.", progress });
    }

    await admin.from("ingestion_progress")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", progress.id);

    // Use file-level cursor (last_processed_lead_id stores last file ID)
    let fileQuery = admin
      .from("lead_files")
      .select("id, lead_id, file_name, storage_path, file_url")
      .eq("company_id", companyId)
      .not("storage_path", "is", null)
      .or("file_name.ilike.%.xls,file_name.ilike.%.xlsx")
      .order("id", { ascending: true });

    if (progress.last_processed_lead_id) {
      fileQuery = fileQuery.gt("id", progress.last_processed_lead_id);
    }

    const { data: files } = await fileQuery.limit(MAX_FILES_PER_BATCH);

    if (!files || files.length === 0) {
      await admin.from("ingestion_progress").update({
        status: "completed", completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", progress.id);
      return json({ message: "All files processed", progress });
    }

    let processedFiles = 0;
    let failedFiles = 0;
    const errors: any[] = [];

    for (const file of files) {
      try {
        console.log(`📄 Processing: ${file.file_name} (id: ${file.id})`);

        // Download file
        let arrayBuf: ArrayBuffer;
        if (file.storage_path) {
          const { data: fileData, error: dlErr } = await admin.storage
            .from(BUCKET).download(file.storage_path);
          if (dlErr || !fileData) {
            console.error(`Download fail: ${file.storage_path}`);
            failedFiles++;
            errors.push({ file: file.file_name, error: "Download failed" });
            continue;
          }
          arrayBuf = await fileData.arrayBuffer();
        } else if (file.file_url) {
          try {
            const resp = await fetch(file.file_url);
            if (!resp.ok) { failedFiles++; errors.push({ file: file.file_name, error: `HTTP ${resp.status}` }); continue; }
            arrayBuf = await resp.arrayBuffer();
          } catch { failedFiles++; errors.push({ file: file.file_name, error: "Fetch failed" }); continue; }
        } else {
          failedFiles++;
          errors.push({ file: file.file_name, error: "No download path" });
          continue;
        }

        // SIZE CHECK — skip files that will crash XLSX.read
        if (arrayBuf.byteLength > MAX_FILE_SIZE_BYTES) {
          console.warn(`⏭️ Skipping ${file.file_name}: ${(arrayBuf.byteLength / 1024 / 1024).toFixed(1)}MB > 5MB limit`);
          failedFiles++;
          errors.push({ file: file.file_name, error: `Too large: ${(arrayBuf.byteLength / 1024 / 1024).toFixed(1)}MB` });
          continue;
        }

        // Parse XLSX with safety wrapper
        let items: any[] = [];
        try {
          const workbook = XLSX.read(new Uint8Array(arrayBuf), { type: "array" });
          const firstSheet = workbook.SheetNames[0];
          const rows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });
          items = parseRebarCADRows(rows);
        } catch (parseErr) {
          console.error(`Parse error ${file.file_name}:`, parseErr);
          failedFiles++;
          errors.push({ file: file.file_name, error: "XLSX parse failed" });
          continue;
        }

        if (items.length === 0) {
          console.log(`⏭️ ${file.file_name}: No rebar items found`);
          processedFiles++;
          continue;
        }

        // Resolve project for FK
        const leadId = file.lead_id;
        let projectId: string | null = null;
        try {
          const { data: existingProject } = await admin.from("projects")
            .select("id").eq("id", leadId).maybeSingle();
          if (existingProject) {
            projectId = existingProject.id;
          } else {
            const { data: lead } = await admin.from("leads").select("title").eq("id", leadId).maybeSingle();
            const { data: newProj } = await admin.from("projects").insert({
              id: leadId,
              company_id: companyId,
              name: lead?.title ?? "Imported Project",
              status: "active",
            }).select("id").maybeSingle();
            projectId = newProj?.id ?? null;
          }
        } catch (projErr) {
          console.error(`Project resolution failed for lead ${leadId}:`, projErr);
        }

        if (!projectId) {
          console.error(`Skipping ${file.file_name}: cannot resolve project_id`);
          failedFiles++;
          errors.push({ file: file.file_name, error: "No project_id" });
          continue;
        }

        const summary = summarizeBarlist(items);

        // Create barlist
        const { data: barlist, error: blErr } = await admin.from("barlists").insert({
          company_id: companyId,
          project_id: projectId,
          lead_id: leadId,
          name: file.file_name.replace(/\.(xls|xlsx)$/i, ""),
          source_type: "historical_import",
          status: "approved",
          created_by: userId,
        }).select("id").single();

        if (blErr || !barlist) {
          console.error(`Barlist insert failed:`, blErr);
          failedFiles++;
          errors.push({ file: file.file_name, error: "Barlist insert failed" });
          continue;
        }

        // Insert items in small batches
        const itemRows = items.map((item) => ({
          barlist_id: barlist.id,
          bar_code: item.bar_size,
          qty: item.quantity,
          cut_length_mm: item.cut_length_mm,
          mark: item.mark,
          shape_code: item.shape_code,
          drawing_ref: item.drawing_ref,
          dims_json: item.dimensions,
          weight_kg: item.weight_kg,
          grade: item.grade,
          status: "approved",
          notes: `Imported from ${file.file_name}`,
        }));

        for (let i = 0; i < itemRows.length; i += 50) {
          try {
            await admin.from("barlist_items").insert(itemRows.slice(i, i + 50));
          } catch (e) {
            console.error(`Batch insert error:`, e);
          }
        }

        processedFiles++;
        console.log(`✅ ${file.file_name}: ${items.length} items, ${summary.total_weight_kg} kg`);
      } catch (fileErr) {
        failedFiles++;
        errors.push({ file: file.file_name, error: String(fileErr) });
        console.error(`❌ ${file.file_name}:`, fileErr);
      }
    }

    // Cursor = last file ID processed
    const lastFileId = files[files.length - 1]?.id;
    await admin.from("ingestion_progress").update({
      processed_files: (progress.processed_files ?? 0) + processedFiles,
      failed_items: (progress.failed_items ?? 0) + failedFiles,
      last_processed_lead_id: lastFileId,
      error_log: [...(progress.error_log ?? []), ...errors],
      updated_at: new Date().toISOString(),
    }).eq("id", progress.id);

    return json({
      message: `Processed ${processedFiles} files, ${failedFiles} failed`,
      last_file_id: lastFileId,
      has_more: files.length === MAX_FILES_PER_BATCH,
      files_processed: processedFiles,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("ingest-historical-barlists error:", err);
    return json({ error: err instanceof Error ? err.message : "Ingestion failed" }, 500);
  }
});
