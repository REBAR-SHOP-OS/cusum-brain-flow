import { handleRequest } from "../_shared/requestHandler.ts";
import { json } from "../_shared/auth.ts";

const BEN_PROFILE_ID = "9425cc2b-9f02-4d44-bb1a-e24928f44bd7";
const BEN_STAGES = ["estimation_ben", "qc_ben", "addendums"];

const STAGE_LABELS: Record<string, string> = {
  estimation_ben: "Estimation - Ben",
  qc_ben: "QC - Ben",
  addendums: "Addendums",
};

/**
 * Creates tasks for overdue pipeline leads assigned to Ben.
 * Migrated to handleRequest wrapper (Phase 1.2).
 */
Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient }) => {
    const today = new Date().toISOString().split("T")[0];

    const { data: leads, error: leadsErr } = await serviceClient
      .from("leads")
      .select("id, stage, expected_close_date, company_id, customer_id, customers(name, company_name)")
      .in("stage", BEN_STAGES)
      .lte("expected_close_date", today)
      .not("expected_close_date", "is", null);

    if (leadsErr) throw json({ error: leadsErr.message }, 500);
    if (!leads || leads.length === 0) return { created: 0, message: "No overdue leads found" };

    // Deduplication
    const leadIds = leads.map((l: any) => l.id);
    const { data: existingTasks } = await serviceClient
      .from("tasks")
      .select("source_ref")
      .in("source", ["pipeline_overdue", "pipeline_today"])
      .in("source_ref", leadIds)
      .neq("status", "completed");

    const existingRefs = new Set((existingTasks || []).map((t: any) => t.source_ref));

    const newTasks = leads
      .filter((l: any) => !existingRefs.has(l.id))
      .map((l: any) => {
        const customerName = l.customers?.company_name || l.customers?.name || "Unknown";
        const stageLabel = STAGE_LABELS[l.stage] || l.stage;
        const isToday = l.expected_close_date === today;
        const prefix = isToday ? "Due Today" : "Overdue";
        return {
          title: `${prefix}: ${customerName} – ${stageLabel}`,
          description: `Pipeline lead is ${isToday ? "due today" : "overdue"} (expected close: ${l.expected_close_date}). Please follow up.`,
          assigned_to: BEN_PROFILE_ID,
          source: isToday ? "pipeline_today" : "pipeline_overdue",
          source_ref: l.id,
          priority: isToday ? "medium" : "high",
          due_date: l.expected_close_date,
          company_id: l.company_id,
          customer_id: l.customer_id,
          status: "pending",
        };
      });

    if (newTasks.length === 0) return { created: 0, message: "All overdue leads already have tasks" };

    const { error: insertErr } = await serviceClient.from("tasks").insert(newTasks);
    if (insertErr) throw json({ error: insertErr.message }, 500);

    return { created: newTasks.length, message: `Created ${newTasks.length} overdue/due-today task(s) for Ben` };
  }, { functionName: "sync-overdue-tasks", requireCompany: false, wrapResult: false }),
);
