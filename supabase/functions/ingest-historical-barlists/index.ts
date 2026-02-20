import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";
import { parseRebarCADRows, summarizeBarlist } from "../_shared/rebarCADParser.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5/xlsx.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await requireAuth(req);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get user's company
    const { data: profile } = await admin.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
    if (!profile?.company_id) return json({ error: "No company found" }, 400);
    const companyId = profile.company_id;

    const body = await req.json();
    const batchSize = body.batch_size ?? 10;
    const priorityStages = body.priority_stages ?? ["won", "delivered", "shop_drawing_approval"];

    // Get or create progress tracker
    let { data: progress } = await admin
      .from("ingestion_progress")
      .select("*")
      .eq("job_type", "barlists")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!progress) {
      // Count total leads with files
      const { count } = await admin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .in("stage", priorityStages);

      const { data: inserted } = await admin.from("ingestion_progress").insert({
        job_type: "barlists",
        company_id: companyId,
        total_items: count ?? 0,
        status: "running",
        started_at: new Date().toISOString(),
      }).select().single();
      progress = inserted;
    }

    if (progress.status === "completed") {
      return json({ message: "Barlist ingestion already completed", progress });
    }

    // Update status to running
    await admin.from("ingestion_progress")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", progress.id);

    // Fetch next batch of leads
    let query = admin
      .from("leads")
      .select("id, name, customer_id, stage")
      .eq("company_id", companyId)
      .in("stage", priorityStages)
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
    const errors: any[] = [];

    for (const lead of leads) {
      try {
        // List files in odoo-archive/{lead_id}/
        const { data: files } = await admin.storage
          .from("odoo-archive")
          .list(lead.id, { limit: 100 });

        if (!files) { processedCount++; continue; }

        // Filter for bar list files
        const barlistFiles = files.filter((f: any) => {
          const name = f.name.toLowerCase();
          return (name.includes("bar_list") || name.includes("barlist") || name.includes("bar list"))
            && (name.endsWith(".xls") || name.endsWith(".xlsx"));
        });

        for (const file of barlistFiles) {
          try {
            // Download file
            const filePath = `${lead.id}/${file.name}`;
            const { data: fileData, error: dlErr } = await admin.storage
              .from("odoo-archive")
              .download(filePath);

            if (dlErr || !fileData) {
              console.error(`Failed to download ${filePath}:`, dlErr);
              continue;
            }

            // Parse XLS
            const arrayBuf = await fileData.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuf), { type: "array" });
            const firstSheet = workbook.SheetNames[0];
            const rows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });

            const items = parseRebarCADRows(rows);
            if (items.length === 0) continue;

            const summary = summarizeBarlist(items);

            // Create barlist record
            const { data: barlist, error: blErr } = await admin.from("barlists").insert({
              company_id: companyId,
              project_id: lead.id, // Using lead as project reference
              lead_id: lead.id,
              name: file.name.replace(/\.(xls|xlsx)$/i, ""),
              source_type: "historical_import",
              status: "approved",
              created_by: userId,
            }).select("id").single();

            if (blErr || !barlist) {
              console.error(`Failed to create barlist for ${file.name}:`, blErr);
              continue;
            }

            // Insert items
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
              notes: `Imported from ${file.name}`,
            }));

            // Insert in batches of 100
            for (let i = 0; i < itemRows.length; i += 100) {
              const batch = itemRows.slice(i, i + 100);
              try {
                await admin.from("barlist_items").insert(batch);
              } catch (e) {
                console.error(`Batch insert error for ${file.name}:`, e);
              }
            }

            console.log(`Parsed ${items.length} items from ${file.name} (${summary.total_weight_kg} kg)`);
          } catch (fileErr) {
            console.error(`Error processing file ${file.name}:`, fileErr);
          }
        }

        processedCount++;
      } catch (leadErr) {
        failedCount++;
        errors.push({ lead_id: lead.id, error: String(leadErr) });
        console.error(`Error processing lead ${lead.id}:`, leadErr);
      }
    }

    // Update progress
    const lastLeadId = leads[leads.length - 1]?.id;
    await admin.from("ingestion_progress").update({
      processed_items: (progress.processed_items ?? 0) + processedCount,
      failed_items: (progress.failed_items ?? 0) + failedCount,
      last_processed_lead_id: lastLeadId,
      error_log: [...(progress.error_log ?? []), ...errors],
      updated_at: new Date().toISOString(),
    }).eq("id", progress.id);

    return json({
      message: `Processed ${processedCount} leads, ${failedCount} failed`,
      batch_size: leads.length,
      last_lead_id: lastLeadId,
      has_more: leads.length === batchSize,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("ingest-historical-barlists error:", err);
    return json({ error: err instanceof Error ? err.message : "Ingestion failed" }, 500);
  }
});
