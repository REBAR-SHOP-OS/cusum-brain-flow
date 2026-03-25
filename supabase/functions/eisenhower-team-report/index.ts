import { handleRequest } from "../_shared/requestHandler.ts";

/**
 * Admin-only endpoint: fetches all Eisenhower Matrix sessions with user profiles.
 * Migrated to handleRequest wrapper (Phase 1.2).
 */
Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient, body }) => {
    const employeeId = body.employee_id;

    // Fetch all Eisenhower sessions with service role (bypasses RLS)
    let sessionsQuery = serviceClient
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

    // Fetch profiles
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("user_id, full_name, email, avatar_url")
      .in("user_id", userIds.length > 0 ? userIds : ["none"]);

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => {
      profileMap[p.user_id] = p;
    });

    // Fetch last agent message per session
    const sessionIds = (sessions || []).map((s: any) => s.id);
    const { data: messages } = await serviceClient
      .from("chat_messages")
      .select("*")
      .in("session_id", sessionIds.length > 0 ? sessionIds : ["none"])
      .eq("role", "agent")
      .order("created_at", { ascending: false });

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

    return { employees: Object.values(employeeMap) };
  }, { functionName: "eisenhower-team-report", requireRole: "admin", requireCompany: false, wrapResult: false }),
);
