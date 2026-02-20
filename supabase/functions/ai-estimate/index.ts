import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import {
  calculateItem,
  applyWasteFactor,
  computeProjectSummary,
  validateItem,
  type RebarStandard,
  type EstimationPricing,
  type EstimationItemInput,
  type EstimationItemResult,
  type ValidationRule,
} from "../_shared/rebarCalcEngine.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = profile.company_id;
    const body = await req.json();
    const {
      name,
      customer_id,
      lead_id,
      file_urls = [],
      waste_factor_pct = 5,
      scope_context,
    } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: "Project name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 1. Load standards, pricing, validation rules, AND historical learnings ───
    const [standardsRes, pricingRes, rulesRes, learningsRes, benchmarksRes] = await Promise.all([
      supabaseAdmin.from("rebar_standards").select("*"),
      supabaseAdmin
        .from("estimation_pricing")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true),
      supabaseAdmin
        .from("estimation_validation_rules")
        .select("*")
        .eq("is_active", true),
      // Historical learnings for few-shot context
      supabaseAdmin
        .from("estimation_learnings")
        .select("element_type, bar_size, mark, field_name, original_value, corrected_value, weight_delta_pct, context, confidence_score")
        .eq("company_id", companyId)
        .gte("confidence_score", 70)
        .order("confidence_score", { ascending: false })
        .limit(50),
      // Weight benchmarks from coordination logs
      supabaseAdmin
        .from("project_coordination_log")
        .select("project_name, estimation_weight_kg, detailing_weight_kg, weight_difference_kg, elements")
        .eq("company_id", companyId)
        .gt("detailing_weight_kg", 0)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const standards: RebarStandard[] = standardsRes.data ?? [];
    const pricing: EstimationPricing[] = pricingRes.data ?? [];
    const rules: ValidationRule[] = rulesRes.data ?? [];
    const learnings = learningsRes.data ?? [];
    const benchmarks = benchmarksRes.data ?? [];

    const standardsMap = new Map(standards.map((s) => [s.bar_size, s]));
    const pricingMap = new Map(pricing.map((p) => [p.bar_size, p]));

    // Build historical context string for Gemini
    let historicalContext = "";
    if (learnings.length > 0) {
      const avgDelta = learnings.reduce((s, l) => s + (l.weight_delta_pct ?? 0), 0) / learnings.length;
      historicalContext += `\n## HISTORICAL ACCURACY DATA (from ${learnings.length} past corrections)\n`;
      historicalContext += `Average estimation overestimate: ${avgDelta.toFixed(1)}%\n`;

      // Group learnings by element type
      const byElement = new Map<string, { count: number; avgDelta: number }>();
      for (const l of learnings) {
        const et = l.element_type ?? "unknown";
        const entry = byElement.get(et) ?? { count: 0, avgDelta: 0 };
        entry.count++;
        entry.avgDelta += l.weight_delta_pct ?? 0;
        byElement.set(et, entry);
      }
      for (const [et, stats] of byElement) {
        historicalContext += `- ${et}: avg ${(stats.avgDelta / stats.count).toFixed(1)}% overestimate (${stats.count} samples)\n`;
      }
    }
    if (benchmarks.length > 0) {
      historicalContext += `\n## WEIGHT BENCHMARKS FROM COMPLETED PROJECTS\n`;
      for (const b of benchmarks.slice(0, 10)) {
        historicalContext += `- "${b.project_name}": est=${b.estimation_weight_kg}kg, actual=${b.detailing_weight_kg}kg (${((b.weight_difference_kg / b.estimation_weight_kg) * 100).toFixed(1)}% delta)\n`;
      }
    }
    // ─── 2. Send files directly to Gemini 2.5 Pro for vision extraction ───
    let extractedItems: EstimationItemInput[] = [];

    if (file_urls.length > 0) {
      try {
        // Build multipart content for Gemini — PDF and images supported natively
        const parts: any[] = [];

        for (const url of file_urls.slice(0, 10)) {
          // Fetch file and convert to base64 for inline_data
          const fileRes = await fetch(url);
          if (!fileRes.ok) {
            console.error(`Failed to fetch file: ${url} — ${fileRes.status}`);
            continue;
          }
          const arrayBuf = await fileRes.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuf);
          
          // Convert to base64
          let binary = "";
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const base64 = btoa(binary);

          // Determine MIME type
          const lowerUrl = url.toLowerCase();
          let mimeType = "application/pdf";
          if (lowerUrl.includes(".png")) mimeType = "image/png";
          else if (lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg")) mimeType = "image/jpeg";
          else if (lowerUrl.includes(".tif") || lowerUrl.includes(".tiff")) mimeType = "image/tiff";

          parts.push({
            inline_data: { mime_type: mimeType, data: base64 },
          });
        }

        // Add the extraction prompt with historical learning context
        parts.push({
          text: `You are a senior Canadian rebar detailer and structural estimator. Analyze the uploaded structural/shop drawings and extract ALL rebar reinforcement items.

${scope_context ? `Context: ${scope_context}` : ""}
${historicalContext}

## CANADIAN SHOP DRAWING NOTATION GUIDE

These drawings use RebarCAD notation common in Canadian rebar detailing. Key patterns:

### Mark Prefixes
- **LS** prefix (e.g. LS02, LS117, LS125): Straight bars (no bends)
- **AS** prefix (e.g. AS24, AS57, AS81): Straight bars (alternate series)
- **L** prefix (e.g. L1003, L1510, L2009): Bent shapes — the digits encode bar size (e.g. L15xx = 15M bar, L20xx = 20M bar)
- **A** prefix (e.g. A1505, A1552): Bent shapes (alternate series)

### Quantity Notation
- Simple: "5" means 5 pieces
- Layer multiplier: "2x11" means 2 layers × 11 bars = 22 total bars
- "4x2" means 4 sets × 2 bars = 8 total bars

### Bend Types (ACI/RebarCAD)
- **Type 2**: L-shape (90° hook on one end) — dimensions A, B
- **Type 3**: Cranked/Z-shape — dimensions A, B, C
- **Type 17**: U-bar/stirrup (hook both ends) — dimensions A, B
- **T1**: Custom trapezoidal — dimensions A through G
- **Straight (no type)**: Single dimension A = full length

### Position Codes
- BLL = Bottom Long-way Lower
- TUL = Top Upper-way Lower
- T&B = Top & Bottom
- SF/EF = Start Face / End Face
- EW = Each Way
- DWL = Dowel

### Spacing
- "@12\"" means spaced at 12 inches = 305mm
- "@8\"" means spaced at 8 inches = 203mm

### Dimensions
- All dimensions are in imperial (feet-inches): 4'-2" = 1270mm, 30'-0" = 9144mm
- Convert ALL dimensions to millimeters for output

## EXTRACTION INSTRUCTIONS

For each rebar callout found on the drawings, extract:
- element_type: "footing", "column", "beam", "slab", "wall", "pier", "grade_beam", "retaining_wall", "stair", "pool_slab", "pool_deck"
- element_ref: structural element reference label (e.g. W6, W7, GB1, F1, SD29)
- mark: the bar mark as shown (e.g. LS02, L1510, A1505, AS24)
- bar_size: Canadian metric size (10M, 15M, 20M, 25M, 30M, 35M)
- quantity: TOTAL number of bars after resolving multipliers (e.g. "2x11" = 22)
- cut_length_mm: total length in mm (convert from imperial feet-inches)
- hook_type_near: "90", "180", or "none"
- hook_type_far: "90", "180", or "none"
- lap_type: "tension", "compression", or "none"
- num_laps: number of lap splices (0 if none)
- spacing_mm: spacing in mm if applicable (convert from inches), null if not specified
- shape_code: "straight", "L-shape", "U-bar", "stirrup", "cranked", "trapezoidal", "dowel"
- bend_type: the RebarCAD bend type number if visible (2, 3, 17, T1, etc.) or null
- position: position code if visible (BLL, TUL, T&B, EW, etc.) or null
- drawing_ref: the drawing sheet reference (e.g. SD29, SD31, SD03)
- page_index: which uploaded file/page this item was found on (0-based index)
- bbox: bounding box of the rebar callout as {"x": float, "y": float, "w": float, "h": float} with normalized 0.0-1.0 coordinates relative to full page. x,y = top-left corner. Be precise — these will be used for colored overlays.

## CRITICAL RULES
1. Convert ALL imperial dimensions to millimeters: 1 foot = 304.8mm, 1 inch = 25.4mm
2. Resolve ALL multipliers: "2x11" = 22 bars, "4x2" = 8 bars
3. For bent shapes, cut_length_mm = total developed length (sum of all dimensions A+B+C+...)
4. Extract EVERY single bar callout — do not skip any
5. If a bar appears on multiple drawing sheets, list each occurrence separately
6. For bbox: x=0.0 is left edge, x=1.0 is right, y=0.0 is top, y=1.0 is bottom

Return ONLY a valid JSON array of items.`,
        });

        // Call Gemini directly with native multimodal API
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 32000,
              },
            }),
          }
        );

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          console.error("Gemini API error:", geminiRes.status, errText);
        } else {
          const geminiData = await geminiRes.json();
          const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          console.log("Gemini extraction response length:", content.length);

          // Parse JSON array from response
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            extractedItems = JSON.parse(jsonMatch[0]);
            console.log(`Extracted ${extractedItems.length} items from drawings`);
          } else {
            console.error("No JSON array found in Gemini response");
          }
        }
      } catch (e) {
        console.error("Gemini vision extraction error:", e);
      }
    }

    // ─── 3. Deterministic Calculation ───
    let calculatedItems: EstimationItemResult[] = [];

    for (const input of extractedItems) {
      const std = standardsMap.get(input.bar_size);
      if (!std) {
        calculatedItems.push({
          ...input,
          hook_type_near: input.hook_type_near ?? "none",
          hook_type_far: input.hook_type_far ?? "none",
          lap_type: input.lap_type ?? "none",
          hook_allowance_mm: 0,
          lap_allowance_mm: 0,
          total_length_mm: input.cut_length_mm,
          weight_kg: 0,
          unit_cost: 0,
          line_cost: 0,
          warnings: [`Unknown bar size: ${input.bar_size}`],
        });
        continue;
      }

      const p = pricingMap.get(input.bar_size);
      const result = calculateItem(input, std, p);
      result.warnings = validateItem(result, rules);
      calculatedItems.push(result);
    }

    // Apply waste factor
    if (waste_factor_pct > 0) {
      calculatedItems = applyWasteFactor(calculatedItems, waste_factor_pct);
    }

    // ─── 4. Compute summary ───
    const summary = computeProjectSummary(calculatedItems);

    const totalLaborHours = pricing.length > 0
      ? calculatedItems.reduce((sum, item) => {
          const p = pricingMap.get(item.bar_size);
          if (!p || p.kg_per_labor_hour <= 0) return sum;
          return sum + item.weight_kg / p.kg_per_labor_hour;
        }, 0)
      : 0;

    // ─── 5. Persist ───
    const { data: project, error: projErr } = await supabaseAdmin
      .from("estimation_projects")
      .insert({
        name,
        customer_id: customer_id || null,
        lead_id: lead_id || null,
        status: extractedItems.length > 0 ? "completed" : "draft",
        source_files: file_urls.map((u: string) => ({ url: u })),
        element_summary: summary.element_summary,
        total_weight_kg: summary.total_weight_kg,
        total_cost: summary.total_cost,
        waste_factor_pct,
        labor_hours: Math.round(totalLaborHours * 100) / 100,
        created_by: user.id,
        company_id: companyId,
      })
      .select("id")
      .single();

    if (projErr) {
      console.error("Project insert error:", projErr);
      return new Response(JSON.stringify({ error: "Failed to save project" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert items
    if (calculatedItems.length > 0) {
      const itemRows = calculatedItems.map((item) => ({
        project_id: project.id,
        element_type: item.element_type,
        element_ref: item.element_ref,
        mark: item.mark,
        bar_size: item.bar_size,
        grade: item.grade ?? "400W",
        shape_code: item.shape_code,
        quantity: item.quantity,
        cut_length_mm: item.cut_length_mm,
        total_length_mm: item.total_length_mm,
        hook_allowance_mm: item.hook_allowance_mm,
        lap_allowance_mm: item.lap_allowance_mm,
        weight_kg: item.weight_kg,
        spacing_mm: item.spacing_mm,
        dimensions: item.dimensions,
        unit_cost: item.unit_cost,
        line_cost: item.line_cost,
        source: "ai_extracted",
        warnings: item.warnings,
        bbox: (item as any).bbox ?? null,
        page_index: (item as any).page_index ?? 0,
      }));

      const { error: itemsErr } = await supabaseAdmin
        .from("estimation_items")
        .insert(itemRows);

      if (itemsErr) {
        console.error("Items insert error:", itemsErr);
      }
    }

    // ─── 6. Return ───
    return new Response(
      JSON.stringify({
        success: true,
        project_id: project.id,
        summary: {
          ...summary,
          labor_hours: Math.round(totalLaborHours * 100) / 100,
          waste_factor_pct,
        },
        items: calculatedItems,
        warnings: calculatedItems.flatMap((i) => i.warnings),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ai-estimate error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Estimation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
