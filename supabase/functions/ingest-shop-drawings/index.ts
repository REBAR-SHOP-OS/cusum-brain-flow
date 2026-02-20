import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const BUCKET = "estimation-files";

const REBAR_EXTRACTION_PROMPT = `You are a Canadian rebar detailing expert analyzing a structural shop drawing PDF.

Extract ALL reinforcing steel (rebar) items visible in this drawing. For each bar, provide:
- mark: The bar mark/tag (e.g., "A", "B1", "W3")
- bar_size: Canadian metric size (10M, 15M, 20M, 25M, 30M, 35M)
- quantity: Number of pieces
- cut_length_mm: Total cut length in millimeters
- shape_code: One of: straight, L-shape, U-bar, stirrup, cranked, trapezoidal, other
- grade: Steel grade (default 400W)
- drawing_ref: The drawing/detail number this bar appears in
- dimensions: Object with dimension letters {A, B, C, D, E, F} in mm where applicable

Also provide a summary:
- total_weight_kg: Sum of all bar weights (use: 10M=0.785, 15M=1.570, 20M=2.355, 25M=3.925, 30M=5.495, 35M=7.850 kg/m)
- element_type: The structural element type (footing, wall, slab, beam, column, pier, stair, etc.)
- element_name: The specific element name from the drawing

Respond ONLY with valid JSON in this format:
{
  "items": [{ "mark": "A", "bar_size": "15M", "quantity": 12, "cut_length_mm": 3200, "shape_code": "straight", "grade": "400W", "drawing_ref": "SD-01", "dimensions": {} }],
  "summary": { "total_weight_kg": 123.4, "element_type": "footing", "element_name": "F1" }
}

If the PDF is not a structural drawing or contains no rebar data, respond with: {"items": [], "summary": null}`;

async function callGeminiVision(base64Data: string, mimeType: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: REBAR_EXTRACTION_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Data } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} — ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error("Failed to parse Gemini response as JSON");
  }
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
    const batchSize = body.batch_size ?? 2; // Small batch — AI processing is slow
    const reset = body.reset ?? false;

    let { data: progress } = await admin
      .from("ingestion_progress")
      .select("*")
      .eq("job_type", "shop_drawings")
      .eq("company_id", companyId)
      .maybeSingle();

    if (reset && progress) {
      await admin.from("ingestion_progress").update({
        status: "pending", processed_items: 0, processed_files: 0, failed_items: 0,
        last_processed_lead_id: null, error_log: [], completed_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", progress.id);
      progress.status = "pending";
      progress.processed_files = 0;
      progress.last_processed_lead_id = null;
    }

    if (!progress) {
      const { count: totalPDFs } = await admin
        .from("lead_files")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .not("storage_path", "is", null)
        .ilike("file_name", "%.pdf");

      const { data: inserted } = await admin.from("ingestion_progress").insert({
        job_type: "shop_drawings",
        company_id: companyId,
        source_type: "pdf",
        total_items: 0,
        total_files: totalPDFs ?? 0,
        status: "running",
        started_at: new Date().toISOString(),
      }).select().single();
      progress = inserted;
    }

    if (progress.status === "completed") {
      return json({ message: "Shop drawing ingestion already completed. Use reset=true to re-run.", progress });
    }

    await admin.from("ingestion_progress")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", progress.id);

    // Get next batch of PDF files — filter to likely shop drawings (SD, shop, drawing in name)
    let fileQuery = admin
      .from("lead_files")
      .select("id, lead_id, file_name, storage_path, file_url, mime_type")
      .eq("company_id", companyId)
      .not("storage_path", "is", null)
      .ilike("file_name", "%.pdf")
      .order("id", { ascending: true });

    if (progress.last_processed_lead_id) {
      // Use id-based cursor for PDFs since multiple per lead
      fileQuery = fileQuery.gt("id", progress.last_processed_lead_id);
    }

    const { data: pdfFiles } = await fileQuery.limit(batchSize);

    if (!pdfFiles || pdfFiles.length === 0) {
      await admin.from("ingestion_progress").update({
        status: "completed", completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", progress.id);
      return json({ message: "All shop drawings processed", progress });
    }

    let processedCount = 0;
    let failedCount = 0;
    const errors: any[] = [];

    for (const file of pdfFiles) {
      try {
        console.log(`🔍 Processing PDF: ${file.file_name}`);

        // Download PDF — prefer storage_path, fall back to file_url
        let arrayBuf: ArrayBuffer;
        if (file.storage_path) {
          const { data: fileData, error: dlErr } = await admin.storage
            .from(BUCKET)
            .download(file.storage_path);
          if (dlErr || !fileData) {
            console.error(`Failed to download ${file.storage_path}:`, dlErr);
            failedCount++;
            errors.push({ file: file.file_name, error: "Storage download failed" });
            continue;
          }
          arrayBuf = await fileData.arrayBuffer();
        } else if (file.file_url) {
          try {
            const resp = await fetch(file.file_url);
            if (!resp.ok) {
              failedCount++;
              errors.push({ file: file.file_name, error: `HTTP ${resp.status}` });
              continue;
            }
            arrayBuf = await resp.arrayBuffer();
          } catch (fetchErr) {
            failedCount++;
            errors.push({ file: file.file_name, error: "Fetch failed" });
            continue;
          }
        } else {
          failedCount++;
          errors.push({ file: file.file_name, error: "No download path" });
          continue;
        }

        // Convert to base64 in chunks to avoid stack overflow
        const bytes = new Uint8Array(arrayBuf);

        // Check file size — skip very large PDFs (> 15MB)
        if (bytes.length > 15 * 1024 * 1024) {
          console.warn(`Skipping ${file.file_name}: too large (${(bytes.length / 1024 / 1024).toFixed(1)}MB)`);
          failedCount++;
          errors.push({ file: file.file_name, error: "File too large (>15MB)" });
          continue;
        }

        // Convert to base64 in chunks
        let base64 = "";
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          base64 += String.fromCharCode(...chunk);
        }
        base64 = btoa(base64);

        const mimeType = file.mime_type || "application/pdf";

        // Call Gemini Vision
        const result = await callGeminiVision(base64, mimeType);

        if (!result?.items || result.items.length === 0) {
          console.log(`⏭️ ${file.file_name}: No rebar data found`);
          processedCount++;
          continue;
        }

        // Get lead info
        const { data: lead } = await admin.from("leads").select("title").eq("id", file.lead_id).maybeSingle();

        // Create barlist record
        const { data: barlist, error: blErr } = await admin.from("barlists").insert({
          company_id: companyId,
          project_id: file.lead_id,
          lead_id: file.lead_id,
          name: `AI Extract: ${file.file_name.replace(/\.pdf$/i, "")}`,
          source_type: "ai_vision_extract",
          status: "approved",
          created_by: userId,
        }).select("id").single();

        if (blErr || !barlist) {
          console.error(`Failed to create barlist:`, blErr);
          failedCount++;
          continue;
        }

        // Insert items
        const itemRows = result.items.map((item: any) => ({
          barlist_id: barlist.id,
          bar_code: item.bar_size,
          qty: item.quantity ?? 1,
          cut_length_mm: item.cut_length_mm ?? 0,
          mark: item.mark ?? "",
          shape_code: item.shape_code ?? "other",
          drawing_ref: item.drawing_ref ?? file.file_name,
          dims_json: item.dimensions ?? {},
          weight_kg: item.weight_kg ?? 0,
          grade: item.grade ?? "400W",
          status: "approved",
          notes: `AI vision extract from ${file.file_name}`,
        }));

        for (let i = 0; i < itemRows.length; i += 100) {
          try {
            await admin.from("barlist_items").insert(itemRows.slice(i, i + 100));
          } catch (e) {
            console.error(`Batch insert error:`, e);
          }
        }

        // Log to coordination log
        if (result.summary) {
          try {
            await admin.from("project_coordination_log").insert({
              lead_id: file.lead_id,
              company_id: companyId,
              project_name: lead?.title ?? file.file_name,
              detailing_weight_kg: result.summary.total_weight_kg ?? 0,
              elements: [{ description: result.summary.element_name, type: result.summary.element_type }],
              source_file_url: file.storage_path,
            });
          } catch (e) {
            console.error(`Coordination log insert error:`, e);
          }
        }

        processedCount++;
        console.log(`✅ ${file.file_name}: ${result.items.length} items extracted (${result.summary?.total_weight_kg ?? 0} kg)`);
      } catch (fileErr) {
        failedCount++;
        errors.push({ file: file.file_name, error: String(fileErr) });
        console.error(`❌ ${file.file_name}:`, fileErr);
      }
    }

    // Use file ID as cursor for PDFs
    const lastFileId = pdfFiles[pdfFiles.length - 1]?.id;
    await admin.from("ingestion_progress").update({
      processed_items: (progress.processed_items ?? 0) + processedCount,
      processed_files: (progress.processed_files ?? 0) + processedCount,
      failed_items: (progress.failed_items ?? 0) + failedCount,
      last_processed_lead_id: lastFileId, // Using file ID as cursor
      error_log: [...(progress.error_log ?? []), ...errors],
      updated_at: new Date().toISOString(),
    }).eq("id", progress.id);

    return json({
      message: `Processed ${processedCount} PDFs, ${failedCount} failed`,
      batch_size: pdfFiles.length,
      has_more: pdfFiles.length === batchSize,
      files_processed: processedCount,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("ingest-shop-drawings error:", err);
    return json({ error: err instanceof Error ? err.message : "Ingestion failed" }, 500);
  }
});
