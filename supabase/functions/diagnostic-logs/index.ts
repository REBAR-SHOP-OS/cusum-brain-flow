import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "sattar@rebar.shop";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Super-admin check
    if (user.email !== SUPER_ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden: Super admin access only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { logType = "edge", search = "", limit = 100 } = await req.json();

    const projectRef = supabaseUrl.replace("https://", "").replace(".supabase.co", "");

    let query = "";
    switch (logType) {
      case "edge":
        query = `
          select id, function_edge_logs.timestamp, event_message, 
                 response.status_code, request.method, 
                 m.function_id, m.execution_time_ms, m.deployment_id
          from function_edge_logs
            cross join unnest(metadata) as m
            cross join unnest(m.response) as response
            cross join unnest(m.request) as request
          ${search ? `where event_message ilike '%${search.replace(/'/g, "''")}%'` : ""}
          order by timestamp desc
          limit ${Math.min(Number(limit), 500)}
        `;
        break;
      case "auth":
        query = `
          select id, auth_logs.timestamp, event_message, 
                 metadata.level, metadata.status, metadata.path, 
                 metadata.msg as msg, metadata.error
          from auth_logs
            cross join unnest(metadata) as metadata
          ${search ? `where event_message ilike '%${search.replace(/'/g, "''")}%'` : ""}
          order by timestamp desc
          limit ${Math.min(Number(limit), 500)}
        `;
        break;
      case "postgres":
        query = `
          select identifier, postgres_logs.timestamp, id, event_message, 
                 parsed.error_severity
          from postgres_logs
            cross join unnest(metadata) as m
            cross join unnest(m.parsed) as parsed
          ${search ? `where event_message ilike '%${search.replace(/'/g, "''")}%'` : ""}
          order by timestamp desc
          limit ${Math.min(Number(limit), 500)}
        `;
        break;
      default:
        return new Response(JSON.stringify({ error: "Invalid log type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Use the analytics endpoint
    const analyticsUrl = `${supabaseUrl.replace('.supabase.co', '.supabase.co')}/analytics/v1/query`;
    
    const analyticsResponse = await fetch(analyticsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!analyticsResponse.ok) {
      const errText = await analyticsResponse.text();
      console.error("Analytics API error:", errText);
      return new Response(JSON.stringify({ error: "Failed to fetch logs", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await analyticsResponse.json();

    return new Response(JSON.stringify({ logs: result }), {
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
