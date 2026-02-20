import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5/xlsx.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "estimation-files";

function parseJobLog(rows: any[][]): {
  project_name: string;
  customer_name: string;
  estimation_weight_kg: number;
  detailing_weight_kg: number;
  elements: any[];
  releases: any[];
  revisions: any[];
} {
  let projectName = "";
  let customerName = "";
  let estimationWeight = 0;
  let detailingWeight = 0;
  const elements: any[] = [];
  const releases: any[] = [];
  const revisions: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const cell0 = String(row[0] ?? "").trim().toLowerCase();
    const cell1 = String(row[1] ?? "").trim();

    if (cell0.includes("project") && cell1) projectName = cell1;
    if (cell0.includes("customer") || cell0.includes("client")) customerName = cell1;
    if (cell0.includes("estimation") && cell0.includes("weight"))
      estimationWeight = parseFloat(cell1.replace(/[^0-9.]/g, "")) || 0;
    if (cell0.includes("detail") && cell0.includes("weight"))
      detailingWeight = parseFloat(cell1.replace(/[^0-9.]/g, "")) || 0;

    const releaseMatch = String(row[0] ?? "").match(/^(CB[A-Z]|[A-Z]{2,3}\d*)$/);
    if (releaseMatch) {
      releases.push({
        code: releaseMatch[0],
        description: String(row[1] ?? "").trim(),
        weight_kg: parseFloat(String(row[2] ?? "0").replace(/[^0-9.]/g, "")) || 0,
        date: String(row[3] ?? "").trim(),
        status: String(row[4] ?? "").trim(),
      });
    }

    const elementPatterns = /^(footing|wall|slab|beam|column|pier|grade.?beam|retaining|stair|pool|cabana|foundation)/i;
    if (elementPatterns.test(cell0) || elementPatterns.test(cell1)) {
      const description = cell0 || cell1;
      const weightCol = row.findIndex((c: any, idx: number) => idx > 0 && parseFloat(String(c ?? "").replace(/[^0-9.]/g, "")) > 10);
      elements.push({
        description,
        weight_kg: weightCol >= 0 ? parseFloat(String(row[weightCol]).replace(/[^0-9.]/g, "")) || 0 : 0,
        drawing_refs: String(row[weightCol > 0 ? weightCol - 1 : 2] ?? "").trim(),
      });
    }

    if (cell0.includes("rev") || cell0.match(/^r\d+$/i)) {
      revisions.push({
        revision: String(row[0] ?? "").trim(),
        description: String(row[1] ?? "").trim(),
        weight_delta: parseFloat(String(row[2] ?? "0").replace(/[^0-9.-]/g, "")) || 0,
        date: String(row[3] ?? "").trim(),
        reason: String(row[4] ?? "").trim(),
      });
    }
  }

  if (detailingWeight === 0 && releases.length > 0) {
    detailingWeight = releases.reduce((s, r) => s + r.weight_kg, 0);
  }

  return { project_name: projectName, customer_name: customerName, estimation_weight_kg: estimationWeight, detailing_weight_kg: detailingWeight, elements, releases, revisions };
}

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

    let { data: progress } = await admin
      .from("ingestion_progress")
      .select("*")
      .eq("job_type", "job_logs")
      .eq("company_id", companyId)
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
      // Count job log files from lead_files
      const { count: totalFiles } = await admin
        .from("lead_files")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .not("storage_path", "is", null)
        .or("file_name.ilike.%job%log%.xls,file_name.ilike.%job%log%.xlsx,file_name.ilike.%job_log%.xls,file_name.ilike.%job_log%.xlsx");

      const { data: inserted } = await admin.from("ingestion_progress").insert({
        job_type: "job_logs",
        company_id: companyId,
        source_type: "xls",
        total_items: 0,
        total_files: totalFiles ?? 0,
        status: "running",
        started_at: new Date().toISOString(),
      }).select().single();
      progress = inserted;
    }

    if (progress.status === "completed") {
      return json({ message: "Job log ingestion already completed. Use reset=true to re-run.", progress });
    }

    await admin.from("ingestion_progress")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", progress.id);

    // Query lead_files for job log files directly
    let fileQuery = admin
      .from("lead_files")
      .select("id, lead_id, file_name, storage_path, file_url")
      .eq("company_id", companyId)
      .not("storage_path", "is", null)
      .or("file_name.ilike.%job%log%.xls,file_name.ilike.%job%log%.xlsx,file_name.ilike.%job_log%.xls,file_name.ilike.%job_log%.xlsx")
      .order("lead_id", { ascending: true });

    if (progress.last_processed_lead_id) {
      fileQuery = fileQuery.gt("lead_id", progress.last_processed_lead_id);
    }

    const { data: jobLogFiles } = await fileQuery.limit(batchSize);

    if (!jobLogFiles || jobLogFiles.length === 0) {
      await admin.from("ingestion_progress").update({
        status: "completed", completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", progress.id);
      return json({ message: "All job logs processed", progress });
    }

    let processedCount = 0;
    let failedCount = 0;

    for (const file of jobLogFiles) {
      try {
        let arrayBuf: ArrayBuffer;
        if (file.storage_path) {
          const { data: fileData, error: dlErr } = await admin.storage
            .from(BUCKET)
            .download(file.storage_path);
          if (dlErr || !fileData) { failedCount++; continue; }
          arrayBuf = await fileData.arrayBuffer();
        } else if (file.file_url) {
          try {
            const resp = await fetch(file.file_url);
            if (!resp.ok) { failedCount++; continue; }
            arrayBuf = await resp.arrayBuffer();
          } catch { failedCount++; continue; }
        } else { failedCount++; continue; }

        const workbook = XLSX.read(new Uint8Array(arrayBuf), { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        const rows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });

        const parsed = parseJobLog(rows);

        const { data: lead } = await admin.from("leads").select("name").eq("id", file.lead_id).maybeSingle();

        try {
          await admin.from("project_coordination_log").insert({
            lead_id: file.lead_id,
            company_id: companyId,
            project_name: parsed.project_name || lead?.name || file.file_name,
            customer_name: parsed.customer_name,
            estimation_weight_kg: parsed.estimation_weight_kg,
            detailing_weight_kg: parsed.detailing_weight_kg,
            weight_difference_kg: parsed.estimation_weight_kg - parsed.detailing_weight_kg,
            elements: parsed.elements,
            releases: parsed.releases,
            revisions: parsed.revisions,
            source_file_url: file.storage_path,
          });
        } catch (insertErr) {
          console.error(`Insert error for ${file.file_name}:`, insertErr);
        }

        processedCount++;
        console.log(`✅ Job log: ${file.file_name} (est: ${parsed.estimation_weight_kg}kg, det: ${parsed.detailing_weight_kg}kg)`);
      } catch (fileErr) {
        failedCount++;
        console.error(`Error processing ${file.file_name}:`, fileErr);
      }
    }

    const lastLeadId = jobLogFiles[jobLogFiles.length - 1]?.lead_id;
    await admin.from("ingestion_progress").update({
      processed_items: (progress.processed_items ?? 0) + processedCount,
      processed_files: (progress.processed_files ?? 0) + processedCount,
      failed_items: (progress.failed_items ?? 0) + failedCount,
      last_processed_lead_id: lastLeadId,
      updated_at: new Date().toISOString(),
    }).eq("id", progress.id);

    return json({
      message: `Processed ${processedCount} job logs, ${failedCount} failed`,
      batch_size: jobLogFiles.length,
      last_lead_id: lastLeadId,
      has_more: jobLogFiles.length === batchSize,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("ingest-job-logs error:", err);
    return json({ error: err instanceof Error ? err.message : "Ingestion failed" }, 500);
  }
});
