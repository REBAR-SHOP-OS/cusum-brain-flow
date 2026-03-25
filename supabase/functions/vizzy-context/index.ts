import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

/**
 * Server-side context endpoint for the Vizzy AI assistant.
 * Returns the business snapshot so the client doesn't need 13+ DB queries.
 */
Deno.serve((req) =>
  handleRequest(req, async ({ userId, serviceClient: supabaseAdmin }) => {
    // Admin check
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const snapshot = await buildSnapshotFromContext(supabaseAdmin, userId);

    return { snapshot };
  }, { functionName: "vizzy-context", requireCompany: false, wrapResult: false })
);

// Build a minimal snapshot for client-side buildVizzyContext compatibility
async function buildSnapshotFromContext(supabase: any, userId: string) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [
    { data: cutPlans },
    { data: cutItems },
    { data: completedTodayItems },
    { data: machineRunsToday },
    { data: allMachines },
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
    { data: rcCallsToday },
  ] = await Promise.all([
    supabase.from("cut_plans").select("id, status").in("status", ["queued", "running"]),
    supabase.from("cut_plan_items").select("id, phase, completed_pieces, total_pieces").in("phase", ["queued", "cutting", "bending"]).limit(500),
    Promise.resolve({ data: [] }),
    supabase.from("machine_runs").select("id, machine_id, process, status, started_at, output_qty, operator_profile_id").gte("started_at", today + "T00:00:00").order("started_at", { ascending: false }).limit(100),
    supabase.from("machines").select("id, name").limit(100),
    supabase.from("machines").select("id, name, status, type").eq("status", "running"),
    supabase.from("leads").select("id, title, stage, expected_value, probability").in("stage", ["new", "contacted", "qualified", "proposal"]).order("probability", { ascending: false }).limit(20),
    supabase.from("customers").select("id").eq("status", "active").limit(100),
    supabase.from("deliveries").select("id, status, scheduled_date").gte("scheduled_date", today).lte("scheduled_date", today).limit(50),
    supabase.from("profiles").select("id, full_name, user_id, email").not("full_name", "is", null),
    supabase.from("activity_events").select("id, event_type, entity_type, description, created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("knowledge").select("title, category, content").order("created_at", { ascending: false }).limit(50),
    supabase.from("chat_sessions").select("id, title, agent_name, user_id, created_at").gte("created_at", today + "T00:00:00").order("created_at", { ascending: false }).limit(100),
    supabase.from("time_clock_entries").select("id, profile_id, clock_in, clock_out").gte("clock_in", today + "T00:00:00").order("clock_in", { ascending: false }).limit(100),
    supabase.from("accounting_mirror").select("balance, entity_type, data").eq("entity_type", "Invoice").gt("balance", 0).limit(50),
    supabase.from("accounting_mirror").select("balance, entity_type, data").eq("entity_type", "Vendor").gt("balance", 0).limit(50),
    supabase.from("communications").select("subject, from_address, to_address, body_preview, received_at").eq("direction", "inbound").ilike("to_address", "%@rebar.shop%").order("received_at", { ascending: false }).limit(50),
    supabase.from("communications").select("from_address, to_address, direction, received_at, metadata, source").eq("source", "ringcentral").gte("received_at", today + "T00:00:00").order("received_at", { ascending: false }).limit(500),
  ]);

  const invoices = (accountingInv || []).map((r: any) => ({ Balance: r.balance, DueDate: r.data?.DueDate, CustomerRef: r.data?.CustomerRef }));
  const bills = (accountingBill || []).map((r: any) => ({ Balance: r.balance, DueDate: r.data?.DueDate, VendorRef: r.data?.VendorRef }));
  const todayDate = new Date().toISOString().split("T")[0];
  const overdueInvoices = invoices.filter((inv: any) => inv.Balance > 0 && inv.DueDate && inv.DueDate < todayDate);
  const overdueBills = bills.filter((b: any) => b.Balance > 0 && b.DueDate && b.DueDate < todayDate);

  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
  const profileIdMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
  const emailProfileMap = new Map((profiles || []).map((p: any) => [p.email?.toLowerCase(), p.full_name || "Unknown"]));

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

  // RingCentral call aggregation
  const rcCalls = (rcCallsToday || []).filter((r: any) => {
    const meta = r.metadata as Record<string, unknown> | null;
    return meta?.type === "call";
  });
  const rcCallsByEmployee: Record<string, { outbound: number; inbound: number; missed: number; talkTimeSec: number }> = {};
  const rcCallDetailsList: any[] = [];

  for (const call of rcCalls) {
    const meta = call.metadata as Record<string, unknown> | null;
    const dir = (call.direction || "inbound").toLowerCase();
    const result = (meta?.result as string) || "Unknown";
    const duration = (meta?.duration as number) || 0;
    const isMissed = result === "Missed" || result === "No Answer";

    const addr = dir === "outbound" ? call.from_address : call.to_address;
    const addrClean = addr?.toLowerCase()?.match(/[^<\s]+@[^>\s]+/)?.[0] || addr || "";
    const employeeName = emailProfileMap.get(addrClean) || addrClean;

    if (!rcCallsByEmployee[employeeName]) rcCallsByEmployee[employeeName] = { outbound: 0, inbound: 0, missed: 0, talkTimeSec: 0 };
    if (dir === "outbound") rcCallsByEmployee[employeeName].outbound++;
    else rcCallsByEmployee[employeeName].inbound++;
    if (isMissed) rcCallsByEmployee[employeeName].missed++;
    rcCallsByEmployee[employeeName].talkTimeSec += duration;

    rcCallDetailsList.push({ direction: dir, from: call.from_address, to: call.to_address, duration, result, received_at: call.received_at });
  }

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
      completedToday: (machineRunsToday || []).filter((r: any) => r.status === "completed").length,
      totalPiecesProduced: (machineRunsToday || []).filter((r: any) => r.status === "completed").reduce((s: number, r: any) => s + (r.output_qty || 0), 0),
      machinesRunning: (machines || []).length,
      machineRunsToday: (machineRunsToday || []).length,
    },
    machineRuns: (() => {
      const machineNameMap = new Map((allMachines || []).map((m: any) => [m.id, m.name]));
      const runs = (machineRunsToday || []).map((r: any) => ({
        machine_name: machineNameMap.get(r.machine_id) || "Unknown",
        process: r.process,
        status: r.status,
        started_at: r.started_at,
        output_qty: r.output_qty,
        operator_name: profileIdMap.get(r.operator_profile_id) || null,
      }));
      return { totalToday: runs.length, runs };
    })(),
    crm: {
      openLeads: (leads || []).length,
      hotLeads: (leads || []).filter((l: any) => (l.probability || 0) >= 70).slice(0, 5),
    },
    customers: { totalActive: (customers || []).length },
    deliveries: {
      scheduledToday: (deliveries || []).length,
      inTransit: (deliveries || []).filter((d: any) => d.status === "in-transit").length,
    },
    team: { totalStaff: (profiles || []).length },
    recentEvents: events || [],
    brainKnowledge: knowledge || [],
    agentActivity: Array.from(activityMap.values()),
    teamPresence,
    inboundEmails: communications || [],
    ringcentralCalls: {
      totalCalls: rcCalls.length,
      totalInbound: rcCalls.filter((c: any) => (c.direction || "").toLowerCase() === "inbound").length,
      totalMissed: rcCalls.filter((c: any) => { const m = c.metadata as any; return (m?.result === "Missed" || m?.result === "No Answer"); }).length,
      perEmployee: rcCallsByEmployee,
      details: rcCallDetailsList.slice(0, 50),
    },
  };
}
