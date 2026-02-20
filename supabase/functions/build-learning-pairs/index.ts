import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Build learning pairs by comparing:
 * 1. AI estimation items (estimation_items) against ground truth bar list items (barlist_items)
 * 2. Project-level estimation weight against coordination log detailing weight
 *
 * This creates entries in estimation_learnings that the AI can reference
 * for future takeoffs as few-shot examples and correction patterns.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId } = await requireAuth(req);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: profile } = await admin.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
    if (!profile?.company_id) return json({ error: "No company found" }, 400);
    const companyId = profile.company_id;

    const body = await req.json();
    const batchSize = body.batch_size ?? 20;

    // Strategy 1: Project-level weight comparison
    // Find coordination logs with both estimation and detailing weights
    const { data: coordLogs } = await admin
      .from("project_coordination_log")
      .select("*")
      .eq("company_id", companyId)
      .gt("estimation_weight_kg", 0)
      .gt("detailing_weight_kg", 0)
      .limit(batchSize);

    let pairsCreated = 0;

    for (const log of coordLogs ?? []) {
      const deltaPct = log.estimation_weight_kg > 0
        ? Math.round(((log.estimation_weight_kg - log.detailing_weight_kg) / log.estimation_weight_kg) * 10000) / 100
        : 0;

      try {
        await admin.from("estimation_learnings").insert({
          company_id: companyId,
          lead_id: log.lead_id,
          field_name: "total_weight_kg",
          original_value: String(log.estimation_weight_kg),
          corrected_value: String(log.detailing_weight_kg),
          weight_delta_pct: deltaPct,
          context: {
            project_name: log.project_name,
            customer_name: log.customer_name,
            elements: log.elements,
            releases_count: (log.releases as any[])?.length ?? 0,
            revisions_count: (log.revisions as any[])?.length ?? 0,
          },
          confidence_score: Math.max(0, 100 - Math.abs(deltaPct)),
          source: "ingestion",
        });
        pairsCreated++;
      } catch (e) {
        console.error("Learning pair insert error:", e);
      }

      // Also create element-level learnings from coordination log elements
      for (const element of (log.elements as any[]) ?? []) {
        if (element.weight_kg > 0) {
          try {
            await admin.from("estimation_learnings").insert({
              company_id: companyId,
              lead_id: log.lead_id,
              element_type: element.description?.toLowerCase()?.split(" ")[0] ?? "unknown",
              field_name: "element_weight_kg",
              original_value: "0", // We don't have per-element estimation
              corrected_value: String(element.weight_kg),
              context: {
                project_name: log.project_name,
                element_description: element.description,
                drawing_refs: element.drawing_refs,
              },
              confidence_score: 80,
              source: "ingestion",
            });
            pairsCreated++;
          } catch (e) {
            // Ignore duplicate inserts
          }
        }
      }
    }

    // Strategy 2: Item-level comparison between estimation_items and barlist_items
    // Find estimation projects that have matching barlists via lead_id
    const { data: estProjects } = await admin
      .from("estimation_projects")
      .select("id, lead_id, total_weight_kg")
      .eq("company_id", companyId)
      .not("lead_id", "is", null)
      .limit(batchSize);

    for (const proj of estProjects ?? []) {
      // Find matching barlists
      const { data: barlists } = await admin
        .from("barlists")
        .select("id")
        .eq("lead_id", proj.lead_id)
        .limit(5);

      if (!barlists || barlists.length === 0) continue;

      // Get estimation items
      const { data: estItems } = await admin
        .from("estimation_items")
        .select("mark, bar_size, quantity, weight_kg, element_type")
        .eq("project_id", proj.id)
        .limit(500);

      // Get barlist items (ground truth)
      const barlistIds = barlists.map((b: any) => b.id);
      const { data: blItems } = await admin
        .from("barlist_items")
        .select("mark, bar_code, qty, weight_kg")
        .in("barlist_id", barlistIds)
        .limit(500);

      if (!estItems || !blItems || estItems.length === 0 || blItems.length === 0) continue;

      // Create mark-level learning pairs
      const actualByMark = new Map<string, any>();
      for (const item of blItems) {
        const key = `${item.mark}|${item.bar_code}`;
        if (actualByMark.has(key)) {
          const existing = actualByMark.get(key);
          existing.qty += item.qty;
          existing.weight_kg += item.weight_kg ?? 0;
        } else {
          actualByMark.set(key, { ...item });
        }
      }

      for (const est of estItems) {
        const key = `${est.mark}|${est.bar_size}`;
        const actual = actualByMark.get(key);

        if (actual) {
          const weightDelta = actual.weight_kg > 0
            ? Math.round(((est.weight_kg - actual.weight_kg) / actual.weight_kg) * 10000) / 100
            : 0;

          try {
            await admin.from("estimation_learnings").insert({
              company_id: companyId,
              project_id: proj.id,
              lead_id: proj.lead_id,
              element_type: est.element_type,
              bar_size: est.bar_size,
              mark: est.mark,
              field_name: "item_weight_kg",
              original_value: String(est.weight_kg),
              corrected_value: String(actual.weight_kg),
              weight_delta_pct: weightDelta,
              context: {
                estimated_qty: est.quantity,
                actual_qty: actual.qty,
              },
              confidence_score: Math.max(0, 100 - Math.abs(weightDelta)),
              source: "auto_validation",
            });
            pairsCreated++;
          } catch (e) {
            // Ignore
          }
        }
      }
    }

    return json({
      message: `Created ${pairsCreated} learning pairs`,
      coordination_logs_processed: coordLogs?.length ?? 0,
      estimation_projects_processed: estProjects?.length ?? 0,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("build-learning-pairs error:", err);
    return json({ error: err instanceof Error ? err.message : "Failed" }, 500);
  }
});
