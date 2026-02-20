import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";
import { parseRebarCADRows, summarizeBarlist } from "../_shared/rebarCADParser.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5/xlsx.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "estimation-files";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await requireAuth(req);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: profile } = await admin.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
    if (!profile?.company_id) return json({ error: "No company found" }, 400);
    const companyId = profile.company_id;

    const body = await req.json().catch(() => ({}));
    const batchSize = body.batch_size ?? 20;
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
        status: "pending",
        processed_items: 0,
        processed_files: 0,
        failed_items: 0,
        last_processed_lead_id: null,
        error_log: [],
        completed_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", progress.id);
      progress.status = "pending";
      progress.processed_items = 0;
      progress.processed_files = 0;
      progress.last_processed_lead_id = null;
    }

    if (!progress) {
      // Count total XLS files from lead_files
      const { count: totalFiles } = await admin
        .from("lead_files")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .not("storage_path", "is", null)
        .or("file_name.ilike.%.xls,file_name.ilike.%.xlsx");

      // Count distinct leads with XLS files
      const { data: leadIds } = await admin
        .from("lead_files")
        .select("lead_id")
        .eq("company_id", companyId)
        .not("storage_path", "is", null)
        .or("file_name.ilike.%.xls,file_name.ilike.%.xlsx");
      const uniqueLeads = new Set(leadIds?.map((r: any) => r.lead_id) ?? []);

      const { data: inserted } = await admin.from("ingestion_progress").insert({
        job_type: "barlists",
        company_id: companyId,
        source_type: "xls",
        total_items: uniqueLeads.size,
        total_files: totalFiles ?? 0,
        status: "running",
        started_at: new Date().toISOString(),
      }).select().single();
      progress = inserted;
    }

    if (progress.status === "completed") {
      return json({ message: "Barlist ingestion already completed. Use reset=true to re-run.", progress });
    }

    await admin.from("ingestion_progress")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", progress.id);

    // Get next batch of leads that have XLS files
    let query = admin
      .from("lead_files")
      .select("lead_id")
      .eq("company_id", companyId)
      .not("storage_path", "is", null)
      .or("file_name.ilike.%.xls,file_name.ilike.%.xlsx")
      .order("lead_id", { ascending: true });

    if (progress.last_processed_lead_id) {
      query = query.gt("lead_id", progress.last_processed_lead_id);
    }

    const { data: leadRows } = await query.limit(1000);
    if (!leadRows || leadRows.length === 0) {
      await admin.from("ingestion_progress").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", progress.id);
      return json({ message: "All leads processed", progress });
    }

    // Get unique lead IDs for this batch
    const uniqueLeadIds = [...new Set(leadRows.map((r: any) => r.lead_id))].slice(0, batchSize);

    let processedLeads = 0;
    let processedFiles = 0;
    let failedLeads = 0;
    const errors: any[] = [];

    for (const leadId of uniqueLeadIds) {
      try {
        // Get all XLS files for this lead from lead_files table
        const { data: files } = await admin
          .from("lead_files")
          .select("id, file_name, storage_path, file_url")
          .eq("lead_id", leadId)
          .not("storage_path", "is", null)
          .or("file_name.ilike.%.xls,file_name.ilike.%.xlsx");

        if (!files || files.length === 0) { processedLeads++; continue; }

        // Get lead info
        const { data: lead } = await admin.from("leads").select("id, name, customer_id, stage").eq("id", leadId).maybeSingle();

        for (const file of files) {
          try {
            // Download file — prefer storage_path, fall back to file_url
            let arrayBuf: ArrayBuffer;
            if (file.storage_path) {
              const { data: fileData, error: dlErr } = await admin.storage
                .from(BUCKET)
                .download(file.storage_path);
              if (dlErr || !fileData) {
                console.error(`Failed to download ${file.storage_path}:`, dlErr);
                continue;
              }
              arrayBuf = await fileData.arrayBuffer();
            } else if (file.file_url) {
              try {
                const resp = await fetch(file.file_url);
                if (!resp.ok) { console.error(`HTTP ${resp.status} for ${file.file_url}`); continue; }
                arrayBuf = await resp.arrayBuffer();
              } catch (fetchErr) {
                console.error(`Fetch failed for ${file.file_url}:`, fetchErr);
                continue;
              }
            } else {
              continue; // No download path available
            }

            const workbook = XLSX.read(new Uint8Array(arrayBuf), { type: "array" });
            const firstSheet = workbook.SheetNames[0];
            const rows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });

            const items = parseRebarCADRows(rows);
            if (items.length === 0) {
              processedFiles++;
              continue; // Not a valid RebarCAD file, skip
            }

            const summary = summarizeBarlist(items);

            // Create barlist record
            const { data: barlist, error: blErr } = await admin.from("barlists").insert({
              company_id: companyId,
              project_id: leadId,
              lead_id: leadId,
              name: file.file_name.replace(/\.(xls|xlsx)$/i, ""),
              source_type: "historical_import",
              status: "approved",
              created_by: userId,
            }).select("id").single();

            if (blErr || !barlist) {
              console.error(`Failed to create barlist for ${file.file_name}:`, blErr);
              continue;
            }

            // Insert items in batches of 100
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

            for (let i = 0; i < itemRows.length; i += 100) {
              try {
                await admin.from("barlist_items").insert(itemRows.slice(i, i + 100));
              } catch (e) {
                console.error(`Batch insert error:`, e);
              }
            }

            processedFiles++;
            console.log(`✅ ${file.file_name}: ${items.length} items, ${summary.total_weight_kg} kg`);
          } catch (fileErr) {
            console.error(`Error processing ${file.file_name}:`, fileErr);
          }
        }

        processedLeads++;
      } catch (leadErr) {
        failedLeads++;
        errors.push({ lead_id: leadId, error: String(leadErr) });
      }
    }

    const lastLeadId = uniqueLeadIds[uniqueLeadIds.length - 1];
    await admin.from("ingestion_progress").update({
      processed_items: (progress.processed_items ?? 0) + processedLeads,
      processed_files: (progress.processed_files ?? 0) + processedFiles,
      failed_items: (progress.failed_items ?? 0) + failedLeads,
      last_processed_lead_id: lastLeadId,
      error_log: [...(progress.error_log ?? []), ...errors],
      updated_at: new Date().toISOString(),
    }).eq("id", progress.id);

    return json({
      message: `Processed ${processedLeads} leads (${processedFiles} files), ${failedLeads} failed`,
      batch_size: uniqueLeadIds.length,
      last_lead_id: lastLeadId,
      has_more: uniqueLeadIds.length === batchSize,
      files_processed: processedFiles,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("ingest-historical-barlists error:", err);
    return json({ error: err instanceof Error ? err.message : "Ingestion failed" }, 500);
  }
});
