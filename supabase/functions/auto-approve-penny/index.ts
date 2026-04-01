import { handleRequest } from "../_shared/requestHandler.ts";
import { resolveDefaultCompanyId } from "../_shared/resolveCompany.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient }) => {
    const { data: config } = await serviceClient
      .from("automation_configs")
      .select("enabled, config")
      .eq("automation_key", "auto_approve_penny")
      .maybeSingle();

    if (!config?.enabled) {
      return { skipped: true, reason: "automation disabled" };
    }

    const threshold = (config.config as any)?.amount_threshold || 5000;
    const minDaysOverdue = (config.config as any)?.min_days_overdue || 30;

    const { data: items, error } = await serviceClient
      .from("penny_collection_queue")
      .select("*")
      .eq("status", "pending_approval")
      .lt("amount", threshold)
      .gte("days_overdue", minDaysOverdue);

    if (error) throw error;

    let approved = 0;
    let failed = 0;

    for (const item of items || []) {
      try {
        const { error: upErr } = await serviceClient
          .from("penny_collection_queue")
          .update({
            status: "approved",
            approved_at: new Date().toISOString(),
            approved_by: null,
          })
          .eq("id", item.id);

        if (upErr) throw upErr;

        try {
          await serviceClient.functions.invoke("penny-execute-action", { body: { action_id: item.id } });
        } catch (_) {}

        try {
          await serviceClient.from("activity_events").insert({
            company_id: item.company_id,
            entity_type: "penny_collection_queue",
            entity_id: item.id,
            event_type: "auto_approved",
            description: `Auto-approved collection action for ${item.customer_name} ($${item.amount})`,
            actor_type: "automation",
            source: "auto_approve_penny",
            automation_source: "auto_approve_penny",
          });
        } catch (_) {}

        approved++;
      } catch (_) {
        failed++;
      }
    }

    try {
      await serviceClient.from("automation_runs").insert({
        company_id: "a0000000-0000-0000-0000-000000000001",
        automation_key: "auto_approve_penny",
        automation_name: "Auto-Approve Collections <$5K",
        agent_name: "Penny",
        trigger_type: "cron",
        status: failed > 0 ? "partial" : "completed",
        items_processed: (items || []).length,
        items_succeeded: approved,
        items_failed: failed,
        completed_at: new Date().toISOString(),
      });
    } catch (_) {}

    try {
      await serviceClient.from("automation_configs")
        .update({
          last_run_at: new Date().toISOString(),
          total_runs: (config as any).total_runs + 1,
          total_success: (config as any).total_success + approved,
          total_failed: (config as any).total_failed + failed,
        })
        .eq("automation_key", "auto_approve_penny");
    } catch (_) {}

    return { approved, failed, total: (items || []).length };
  }, { functionName: "auto-approve-penny", requireCompany: false, wrapResult: false })
);
