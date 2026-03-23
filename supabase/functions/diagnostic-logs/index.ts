import { handleRequest } from "../_shared/requestHandler.ts";
import { requireSuperAdmin } from "../_shared/roleCheck.ts";

/**
 * Diagnostic logs — super-admin-only read access to system logs.
 * Migrated to shared handleRequest wrapper for consistent auth/error handling.
 * 
 * Uses requireSuperAdmin for role-first + email-fallback access control.
 */
Deno.serve(async (req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabase, body } = ctx;

    // Super admin check (role-first, email-fallback)
    await requireSuperAdmin(supabase, userId);

    const { logType = "events", search = "", limit = 100 } = body;
    const safeLimit = Math.min(Number(limit) || 100, 500);

    let logs: any[] = [];

    switch (logType) {
      case "events": {
        let query = supabase
          .from("activity_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(safeLimit);

        if (search) {
          query = query.or(
            `event_type.ilike.%${search}%,description.ilike.%${search}%,entity_type.ilike.%${search}%`
          );
        }

        const { data, error } = await query;
        if (error) throw error;

        logs = (data || []).map((e: any) => ({
          id: e.id,
          timestamp: e.created_at,
          event_message: `${e.event_type} on ${e.entity_type}:${e.entity_id}`,
          level: e.event_type?.includes("error") ? "ERROR" : "INFO",
          details: {
            event_type: e.event_type,
            entity_type: e.entity_type,
            entity_id: e.entity_id,
            description: e.description,
            actor_id: e.actor_id,
            actor_type: e.actor_type,
            metadata: e.metadata,
          },
        }));
        break;
      }

      case "commands": {
        let query = supabase
          .from("command_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(safeLimit);

        if (search) {
          query = query.or(
            `raw_input.ilike.%${search}%,parsed_intent.ilike.%${search}%,result_message.ilike.%${search}%`
          );
        }

        const { data, error } = await query;
        if (error) throw error;

        logs = (data || []).map((c: any) => ({
          id: c.id,
          timestamp: c.created_at,
          event_message: c.raw_input,
          level: c.result === "error" ? "ERROR" : c.result === "success" ? "INFO" : "LOG",
          details: {
            raw_input: c.raw_input,
            parsed_intent: c.parsed_intent,
            parsed_params: c.parsed_params,
            result: c.result,
            result_message: c.result_message,
            user_id: c.user_id,
          },
        }));
        break;
      }

      case "machine_runs": {
        let query = supabase
          .from("machine_runs")
          .select("*, machines(name)")
          .order("created_at", { ascending: false })
          .limit(safeLimit);

        if (search) {
          query = query.or(
            `process.ilike.%${search}%,status.ilike.%${search}%,notes.ilike.%${search}%`
          );
        }

        const { data, error } = await query;
        if (error) throw error;

        logs = (data || []).map((r: any) => ({
          id: r.id,
          timestamp: r.created_at,
          event_message: `${r.process} [${r.status}] on ${r.machines?.name || r.machine_id}`,
          level:
            r.status === "rejected" || r.status === "blocked"
              ? "ERROR"
              : r.status === "completed"
              ? "INFO"
              : "LOG",
          details: {
            process: r.process,
            status: r.status,
            machine: r.machines?.name,
            machine_id: r.machine_id,
            started_at: r.started_at,
            ended_at: r.ended_at,
            duration_seconds: r.duration_seconds,
            input_qty: r.input_qty,
            output_qty: r.output_qty,
            scrap_qty: r.scrap_qty,
            notes: r.notes,
          },
        }));
        break;
      }

      case "db_stats": {
        const { data, error } = await supabase.rpc("get_table_stats");
        if (error) throw error;

        logs = (data || []).map((t: any, i: number) => ({
          id: `stat-${i}`,
          timestamp: new Date().toISOString(),
          event_message: `${t.table_name}: ${t.approx_rows} rows — ${t.size_pretty}`,
          level: t.approx_rows > 10000 ? "WARNING" : "INFO",
          details: {
            table_name: t.table_name,
            approx_rows: t.approx_rows,
            size_pretty: t.size_pretty,
            size_bytes: t.size_bytes,
          },
        }));
        break;
      }

      default:
        throw new Response(
          JSON.stringify({ ok: false, error: "Invalid log type" }),
          { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } },
        );
    }

    return { logs };
  }, { functionName: "diagnostic-logs", requireCompany: false })
);
