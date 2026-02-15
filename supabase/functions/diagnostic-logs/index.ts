import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPER_ADMIN_EMAILS = ["sattar@rebar.shop", "radin@rebar.shop", "ai@rebar.shop"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Super-admin check
    if (!SUPER_ADMIN_EMAILS.includes(user.email ?? "")) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Super admin access only" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { logType = "events", search = "", limit = 100 } = await req.json();
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
        return new Response(JSON.stringify({ error: "Invalid log type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ logs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
