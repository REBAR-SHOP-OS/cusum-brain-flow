import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFullVizzyContext } from "../_shared/vizzyFullContext.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Server-side context endpoint for VizzyPage voice mode.
 * Returns the business snapshot so the client doesn't need 13+ DB queries.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await anonClient.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Admin check
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: corsHeaders });
    }

    // Build context server-side using the shared builder
    const contextString = await buildFullVizzyContext(supabaseAdmin, user.id);

    // Return a lightweight snapshot object that buildVizzyContext (client formatter) expects
    // For voice mode, we return the raw context string directly
    return new Response(JSON.stringify({ context: contextString, snapshot: buildSnapshotFromContext(supabaseAdmin, user.id) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("vizzy-context error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Build a minimal snapshot for client-side buildVizzyContext compatibility
async function buildSnapshotFromContext(supabase: any, userId: string) {
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: cutPlans },
    { data: cutItems },
    { data: machines },
    { data: leads },
    { data: customers },
    { data: deliveries },
    { data: profiles },
    { data: events },
    { data: knowledge },
    { data: agentSessions },
    { data: timeClockEntries },
    { data: accountingInv },
    { data: accountingBill },
    { data: communications },
  ] = await Promise.all([
    supabase.from("cut_plans").select("id, status").in("status", ["queued", "running"]),
    supabase.from("cut_plan_items").select("id, phase, completed_pieces, total_pieces").in("phase", ["queued", "cutting", "bending"]).limit(500),
    supabase.from("machines").select("id, name, status, type").eq("status", "running"),
    supabase.from("leads").select("id, title, stage, expected_value, probability").in("stage", ["new", "contacted", "qualified", "proposal"]).order("probability", { ascending: false }).limit(20),
    supabase.from("customers").select("id").eq("status", "active").limit(100),
    supabase.from("deliveries").select("id, status, scheduled_date").gte("scheduled_date", today).lte("scheduled_date", today).limit(50),
    supabase.from("profiles").select("id, full_name, user_id").not("full_name", "is", null),
    supabase.from("activity_events").select("id, event_type, entity_type, description, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("knowledge").select("title, category, content").order("created_at", { ascending: false }).limit(50),
    supabase.from("chat_sessions").select("id, title, agent_name, user_id, created_at").gte("created_at", today + "T00:00:00").order("created_at", { ascending: false }).limit(100),
    supabase.from("time_clock_entries").select("id, profile_id, clock_in, clock_out").gte("clock_in", today + "T00:00:00").order("clock_in", { ascending: false }).limit(100),
    supabase.from("accounting_mirror").select("balance, entity_type, data").eq("entity_type", "Invoice").gt("balance", 0).limit(50),
    supabase.from("accounting_mirror").select("balance, entity_type, data").eq("entity_type", "Vendor").gt("balance", 0).limit(50),
    supabase.from("communications").select("subject, from_address, to_address, body_preview, received_at").eq("direction", "inbound").ilike("to_address", "%@rebar.shop%").order("received_at", { ascending: false }).limit(50),
  ]);

  const invoices = (accountingInv || []).map((r: any) => ({ Balance: r.balance, DueDate: r.data?.DueDate, CustomerRef: r.data?.CustomerRef }));
  const bills = (accountingBill || []).map((r: any) => ({ Balance: r.balance, DueDate: r.data?.DueDate, VendorRef: r.data?.VendorRef }));
  const todayDate = new Date().toISOString().split("T")[0];
  const overdueInvoices = invoices.filter((inv: any) => inv.Balance > 0 && inv.DueDate && inv.DueDate < todayDate);
  const overdueBills = bills.filter((b: any) => b.Balance > 0 && b.DueDate && b.DueDate < todayDate);

  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
  const profileIdMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));

  const activityMap = new Map<string, any>();
  for (const s of (agentSessions || [])) {
    const key = `${s.agent_name}||${s.user_id}`;
    const existing = activityMap.get(key);
    if (existing) existing.session_count++;
    else activityMap.set(key, { agent_name: s.agent_name, session_count: 1, last_topic: s.title, user_name: profileMap.get(s.user_id) || "Unknown" });
  }

  const teamPresence = (timeClockEntries || []).map((e: any) => ({
    name: profileIdMap.get(e.profile_id) || "Unknown",
    clocked_in: e.clock_in,
    clocked_out: e.clock_out,
  }));

  return {
    financials: {
      totalReceivable: invoices.reduce((s: number, i: any) => s + (i.Balance || 0), 0),
      totalPayable: bills.reduce((s: number, b: any) => s + (b.Balance || 0), 0),
      overdueInvoices,
      overdueBills,
      accounts: [],
      payments: [],
      qbConnected: false,
    },
    production: {
      activeCutPlans: (cutPlans || []).length,
      queuedItems: (cutItems || []).length,
      completedToday: (cutItems || []).filter((i: any) => (i.completed_pieces ?? 0) >= (i.total_pieces ?? 0) && (i.total_pieces ?? 0) > 0).length,
      machinesRunning: (machines || []).length,
    },
    crm: {
      openLeads: (leads || []).length,
      hotLeads: (leads || []).filter((l: any) => (l.probability || 0) >= 70).slice(0, 5),
    },
    customers: { totalActive: (customers || []).length },
    deliveries: {
      scheduledToday: (deliveries || []).length,
      inTransit: (deliveries || []).filter((d: any) => d.status === "in_transit").length,
    },
    team: { totalStaff: (profiles || []).length },
    recentEvents: events || [],
    brainKnowledge: knowledge || [],
    agentActivity: Array.from(activityMap.values()),
    teamPresence,
    inboundEmails: communications || [],
  };
}
