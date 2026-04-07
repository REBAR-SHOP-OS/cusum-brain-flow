import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { getWorkspaceTimezone } from "../_shared/getWorkspaceTimezone.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient, body }) => {
    let mode: string | null = body?.mode || null;

    if (!mode || !["morning", "evening", "end_of_day"].includes(mode)) {
      console.log(`BLOCKED: auto-clockout called with invalid/missing mode: ${mode}`);
      return new Response(
        JSON.stringify({ ok: false, error: "Missing or invalid mode. Must be 'morning', 'evening', or 'end_of_day'." }),
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

    // For end_of_day mode, compute 5:00 PM in workspace timezone
    let endOfDayUtc: Date | null = null;
    if (mode === "end_of_day") {
      const tz = await getWorkspaceTimezone(serviceClient);
      // Build "today 17:00" in the workspace timezone then convert to UTC
      const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: tz }));
      const target5pm = new Date(nowInTz);
      target5pm.setHours(17, 0, 0, 0);
      // Offset: difference between UTC and local
      const utcNow = now.getTime();
      const localNow = nowInTz.getTime();
      const offsetMs = utcNow - localNow;
      endOfDayUtc = new Date(target5pm.getTime() + offsetMs);
    }

    let closed = 0;
    const errors: string[] = [];

    for (const entry of openEntries) {
      const clockIn = new Date(entry.clock_in);
      const hoursOpen = (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

      let shouldClose = false;
      let clockOut: Date;

      if (mode === "end_of_day") {
        // Close ALL open entries — no duration threshold
        shouldClose = true;
        clockOut = endOfDayUtc!;
        // If clock_in is after 5 PM (late entry), set clock_out = clock_in + 0 (minimal)
        if (clockOut <= clockIn) {
          clockOut = new Date(clockIn.getTime() + 1000); // 1 second after clock_in
        }
      } else if (mode === "morning") {
        shouldClose = hoursOpen > 14;
        clockOut = new Date(clockIn);
        clockOut.setHours(18, 0, 0, 0);
        if (clockOut <= clockIn) {
          clockOut = new Date(clockIn.getTime() + 8 * 60 * 60 * 1000);
        }
      } else {
        // evening
        shouldClose = hoursOpen > 12;
        clockOut = new Date();
        clockOut.setHours(18, 0, 0, 0);
        if (clockOut <= clockIn) {
          clockOut = new Date(clockIn.getTime() + 8 * 60 * 60 * 1000);
        }
      }

      if (!shouldClose) continue;

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
            company_id: (entry as any).profiles?.company_id || config?.company_id,
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

    // Log automation run
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
