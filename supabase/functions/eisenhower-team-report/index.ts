import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user and check admin role
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r: any) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse optional employee_id filter
    const body = await req.json().catch(() => ({}));
    const employeeId = body.employee_id;

    // Fetch all Eisenhower sessions with service role (bypasses RLS)
    let sessionsQuery = adminClient
      .from("chat_sessions")
      .select("*")
      .eq("agent_name", "Eisenhower Matrix")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (employeeId) {
      sessionsQuery = sessionsQuery.eq("user_id", employeeId);
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery;
    if (sessionsError) throw sessionsError;

    // Get unique user IDs
    const userIds = [...new Set((sessions || []).map((s: any) => s.user_id))];

    // Fetch profiles for those users
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("user_id, full_name, email, avatar_url")
      .in("user_id", userIds.length > 0 ? userIds : ["none"]);

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => {
      profileMap[p.user_id] = p;
    });

    // Fetch messages for each session (last message which is usually the report)
    const sessionIds = (sessions || []).map((s: any) => s.id);
    const { data: messages } = await adminClient
      .from("chat_messages")
      .select("*")
      .in("session_id", sessionIds.length > 0 ? sessionIds : ["none"])
      .eq("role", "agent")
      .order("created_at", { ascending: false });

    // Group last agent message per session
    const lastMessageMap: Record<string, string> = {};
    (messages || []).forEach((m: any) => {
      if (!lastMessageMap[m.session_id]) {
        lastMessageMap[m.session_id] = m.content;
      }
    });

    // Build response grouped by employee
    const employeeMap: Record<string, any> = {};
    (sessions || []).forEach((s: any) => {
      const profile = profileMap[s.user_id] || {};
      if (!employeeMap[s.user_id]) {
        employeeMap[s.user_id] = {
          user_id: s.user_id,
          full_name: profile.full_name || "Unknown",
          email: profile.email || "",
          avatar_url: profile.avatar_url || null,
          sessions: [],
        };
      }
      employeeMap[s.user_id].sessions.push({
        id: s.id,
        title: s.title,
        created_at: s.created_at,
        updated_at: s.updated_at,
        last_report: lastMessageMap[s.id] || null,
      });
    });

    const employees = Object.values(employeeMap);

    return new Response(JSON.stringify({ employees }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("eisenhower-team-report error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
