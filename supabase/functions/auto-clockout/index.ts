import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient, body }) => {
    let mode: string | null = body?.mode || null;

    if (!mode || !["morning", "evening"].includes(mode)) {
      console.log(`BLOCKED: auto-clockout called with invalid/missing mode: ${mode}`);
      return new Response(
        JSON.stringify({ ok: false, error: "Missing or invalid mode. Must be 'morning' or 'evening'." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if automation is enabled
    const { data: config } = await serviceClient
      .from("automation_configs")
      .select("enabled, config")
      .eq("automation_key", "auto_clockout")
      .maybeSingle();

    if (!config?.enabled) {
      return { ok: true, skipped: true, reason: "automation disabled" };
    }

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Find open clock entries
    const { data: openEntries, error: fetchErr } = await serviceClient
      .from("clock_entries")
      .select("id, profile_id, clock_in, type, profiles(full_name, company_id)")
      .is("clock_out", null)
      .not("clock_in", "is", null);

    if (fetchErr) {
      console.error("Failed to fetch open entries:", fetchErr);
      return new Response(
        JSON.stringify({ ok: false, error: fetchErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!openEntries?.length) {
      return { ok: true, closed: 0, message: "No open clock entries found" };
    }

    let closed = 0;
    const errors: string[] = [];

    for (const entry of openEntries) {
      const clockIn = new Date(entry.clock_in);
      const hoursOpen = (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

      // Morning mode: close entries from yesterday (>14h open)
      // Evening mode: close entries open >12h
      const shouldClose = mode === "morning"
        ? hoursOpen > 14
        : hoursOpen > 12;

      if (!shouldClose) continue;

      // Determine clock_out time
      let clockOut: Date;
      if (mode === "morning") {
        // Set to yesterday 6PM
        clockOut = new Date(clockIn);
        clockOut.setHours(18, 0, 0, 0);
        if (clockOut <= clockIn) {
          clockOut = new Date(clockIn.getTime() + 8 * 60 * 60 * 1000);
        }
      } else {
        // Evening: set to today 6PM
        clockOut = new Date();
        clockOut.setHours(18, 0, 0, 0);
        if (clockOut <= clockIn) {
          clockOut = new Date(clockIn.getTime() + 8 * 60 * 60 * 1000);
        }
      }

      const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      const breakMinutes = totalHours > 5 ? 30 : 0;
      const netHours = Math.max(0, totalHours - breakMinutes / 60);

      const { error: updateErr } = await serviceClient
        .from("clock_entries")
        .update({
          clock_out: clockOut.toISOString(),
          total_hours: Number(netHours.toFixed(2)),
          break_minutes: breakMinutes,
          auto_clocked_out: true,
          notes: `Auto clock-out (${mode} sweep). Original open since ${clockIn.toISOString()}.`,
        })
        .eq("id", entry.id);

      if (updateErr) {
        errors.push(`${entry.id}: ${updateErr.message}`);
      } else {
        closed++;

        // Log activity
        try {
          await serviceClient.from("activity_events").insert({
            company_id: defaultCompanyId,
            entity_type: "clock_entry",
            entity_id: entry.id,
            event_type: "auto_clockout",
            description: `Auto clock-out for ${(entry as any).profiles?.full_name || entry.profile_id} (${mode} sweep, was open ${hoursOpen.toFixed(1)}h)`,
            actor_type: "automation",
            source: "auto_clockout",
            automation_source: "auto_clockout",
          });
        } catch (_) {}
      }
    }

    // Log automation run — derive company_id from the first processed entry's profile
    const runCompanyId = openEntries?.[0]
      ? (openEntries[0] as any).profiles?.company_id
      : config?.company_id;

    if (runCompanyId) {
    try {
      await serviceClient.from("automation_runs").insert({
        company_id: runCompanyId,
        automation_key: "auto_clockout",
        automation_name: `Auto Clock-Out (${mode})`,
        agent_name: "System",
        trigger_type: "cron",
        status: errors.length > 0 ? "partial" : "completed",
        items_processed: openEntries.length,
        items_succeeded: closed,
        items_failed: errors.length,
        error_log: errors.length > 0 ? errors : null,
        completed_at: new Date().toISOString(),
        metadata: { mode },
      });
    } catch (_) {}
    }

    return { ok: true, closed, total_open: openEntries.length, errors };
  }, { functionName: "auto-clockout", requireCompany: false, wrapResult: false })
);
