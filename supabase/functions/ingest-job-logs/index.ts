import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5/xlsx.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Parse a Job Log XLS file into structured coordination data.
 * Job Logs typically contain:
 * - Project summary (name, customer, estimation weight, detailing weight)
 * - Release code breakdown (CBA, CBB, ... with weights and dates)
 * - Revision history
 * - Element-level weight breakdown
 */
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

    // Extract project name
    if (cell0.includes("project") && cell1) {
      projectName = cell1;
    }
    // Extract customer
    if (cell0.includes("customer") || cell0.includes("client")) {
      customerName = cell1;
    }
    // Extract estimation weight
    if (cell0.includes("estimation") && cell0.includes("weight")) {
      estimationWeight = parseFloat(cell1.replace(/[^0-9.]/g, "")) || 0;
    }
    // Extract detailing weight
    if (cell0.includes("detail") && cell0.includes("weight")) {
      detailingWeight = parseFloat(cell1.replace(/[^0-9.]/g, "")) || 0;
    }

    // Detect release code rows (e.g., CBA, CBB, CBC...)
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

    // Detect element rows (e.g., "Footing F1", "Wall W6", "Slab S1")
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

    // Detect revision rows
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

  // If we didn't find explicit weights, try summing releases
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

    const body = await req.json();
    const batchSize = body.batch_size ?? 10;

    // Get or create progress tracker
    let { data: progress } = await admin
      .from("ingestion_progress")
      .select("*")
      .eq("job_type", "job_logs")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!progress) {
      const { data: inserted } = await admin.from("ingestion_progress").insert({
        job_type: "job_logs",
        company_id: companyId,
        total_items: 0,
        status: "running",
        started_at: new Date().toISOString(),
      }).select().single();
      progress = inserted;
    }

    if (progress.status === "completed") {
      return json({ message: "Job log ingestion already completed", progress });
    }

    await admin.from("ingestion_progress")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", progress.id);

    // Fetch next batch of leads
    let query = admin
      .from("leads")
      .select("id, name, customer_id")
      .eq("company_id", companyId)
      .order("id", { ascending: true })
      .limit(batchSize);

    if (progress.last_processed_lead_id) {
      query = query.gt("id", progress.last_processed_lead_id);
    }

    const { data: leads } = await query;

    if (!leads || leads.length === 0) {
      await admin.from("ingestion_progress")
        .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", progress.id);
      return json({ message: "All leads processed", progress });
    }

    let processedCount = 0;
    let failedCount = 0;

    for (const lead of leads) {
      try {
        const { data: files } = await admin.storage.from("odoo-archive").list(lead.id, { limit: 100 });
        if (!files) { processedCount++; continue; }

        const jobLogFiles = files.filter((f: any) => {
          const name = f.name.toLowerCase();
          return (name.includes("job_log") || name.includes("job log") || name.includes("joblog"))
            && (name.endsWith(".xls") || name.endsWith(".xlsx"));
        });

        for (const file of jobLogFiles) {
          try {
            const filePath = `${lead.id}/${file.name}`;
            const { data: fileData, error: dlErr } = await admin.storage.from("odoo-archive").download(filePath);
            if (dlErr || !fileData) continue;

            const arrayBuf = await fileData.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuf), { type: "array" });
            const firstSheet = workbook.SheetNames[0];
            const rows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });

            const parsed = parseJobLog(rows);

            // Get signed URL for reference
            const { data: urlData } = await admin.storage.from("odoo-archive").createSignedUrl(filePath, 86400);

            try {
              await admin.from("project_coordination_log").insert({
                lead_id: lead.id,
                company_id: companyId,
                project_name: parsed.project_name || lead.name,
                customer_name: parsed.customer_name,
                estimation_weight_kg: parsed.estimation_weight_kg,
                detailing_weight_kg: parsed.detailing_weight_kg,
                weight_difference_kg: parsed.estimation_weight_kg - parsed.detailing_weight_kg,
                elements: parsed.elements,
                releases: parsed.releases,
                revisions: parsed.revisions,
                source_file_url: urlData?.signedUrl ?? filePath,
              });
            } catch (insertErr) {
              console.error(`Insert error for ${file.name}:`, insertErr);
            }

            console.log(`Parsed job log: ${file.name} (est: ${parsed.estimation_weight_kg}kg, det: ${parsed.detailing_weight_kg}kg)`);
          } catch (fileErr) {
            console.error(`Error processing ${file.name}:`, fileErr);
          }
        }

        processedCount++;
      } catch (leadErr) {
        failedCount++;
        console.error(`Error processing lead ${lead.id}:`, leadErr);
      }
    }

    const lastLeadId = leads[leads.length - 1]?.id;
    await admin.from("ingestion_progress").update({
      processed_items: (progress.processed_items ?? 0) + processedCount,
      failed_items: (progress.failed_items ?? 0) + failedCount,
      last_processed_lead_id: lastLeadId,
      updated_at: new Date().toISOString(),
    }).eq("id", progress.id);

    return json({
      message: `Processed ${processedCount} leads`,
      batch_size: leads.length,
      last_lead_id: lastLeadId,
      has_more: leads.length === batchSize,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("ingest-job-logs error:", err);
    return json({ error: err instanceof Error ? err.message : "Ingestion failed" }, 500);
  }
});
