import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VizzyBusinessSnapshot {
  financials: {
    totalReceivable: number;
    totalPayable: number;
    overdueInvoices: any[];
    overdueBills: any[];
    accounts: any[];
    payments: any[];
    qbConnected: boolean;
  };
  production: {
    activeCutPlans: number;
    queuedItems: number;
    completedToday: number;
    machinesRunning: number;
  };
  crm: {
    openLeads: number;
    hotLeads: any[];
  };
  customers: { totalActive: number };
  deliveries: { scheduledToday: number; inTransit: number };
  team: { totalStaff: number };
  recentEvents: any[];
  brainKnowledge: { title: string; category: string; content: string | null }[];
  agentActivity: { agent_name: string; session_count: number; last_topic: string; user_name: string }[];
  teamPresence: { name: string; clocked_in: string; clocked_out: string | null }[];
  inboundEmails: { subject: string; from_address: string; to_address: string; body_preview: string; received_at: string }[];
}

export function useVizzyContext() {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<VizzyBusinessSnapshot | null>(null);

  const loadFullContext = useCallback(async (): Promise<VizzyBusinessSnapshot | null> => {
    setLoading(true);

    try {
      const today = new Date().toISOString().split("T")[0];

      // Fetch QuickBooks data directly from edge function (bypasses React state race condition)
      const qbPromise = supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "dashboard-summary" },
      }).then(({ data, error }) => {
        if (error) { console.warn("QB fetch error:", error); return null; }
        return data as { invoices: any[]; bills: any[]; payments: any[]; accounts: any[] } | null;
      }).catch(() => null);

      const cutPlansP = supabase.from("cut_plans").select("id, status").in("status", ["queued", "running"]) as any;
      const cutItemsP = supabase.from("cut_plan_items").select("id, phase, completed_pieces, total_pieces")
        .in("phase", ["queued", "cutting", "bending"]).limit(500) as any;
      const machinesP = supabase.from("machines").select("id, name, status, type").eq("status", "running") as any;
      const leadsP = (supabase.from("leads").select("id, title, stage, expected_value, probability, customer_id, contact_id") as any)
        .in("stage", ["new", "contacted", "qualified", "proposal"])
        .order("probability", { ascending: false }).limit(20);
      const customersP = supabase.from("customers").select("id, name, status").eq("status", "active").limit(100) as any;
      const deliveriesP = supabase.from("deliveries").select("id, delivery_number, status, scheduled_date")
        .gte("scheduled_date", today).lte("scheduled_date", today).limit(50) as any;
      const profilesP = supabase.from("profiles").select("id, full_name, user_id").not("full_name", "is", null) as any;
      const eventsP = supabase.from("activity_events").select("id, event_type, entity_type, description, created_at")
        .order("created_at", { ascending: false }).limit(20) as any;
      const knowledgeP = supabase.from("knowledge").select("title, category, content")
        .order("created_at", { ascending: false }).limit(1000) as any;
      const agentSessionsP = supabase.from("chat_sessions").select("id, title, agent_name, user_id, created_at")
        .gte("created_at", today + "T00:00:00")
        .order("created_at", { ascending: false }).limit(200) as any;
      const timeClockP = supabase.from("time_clock_entries").select("id, profile_id, clock_in, clock_out")
        .gte("clock_in", today + "T00:00:00")
        .order("clock_in", { ascending: false }).limit(200) as any;
      const emailsP = supabase.from("communications").select("subject, from_address, to_address, body_preview, received_at")
        .eq("direction", "inbound")
        .ilike("to_address", "%@rebar.shop%")
        .order("received_at", { ascending: false }).limit(50) as any;

      const [qbData, cutPlansRes, cutItemsRes, machinesRes, leadsRes, customersRes, deliveriesRes, profilesRes, eventsRes, knowledgeRes, agentSessionsRes, timeClockRes, emailsRes] = await Promise.all([
        qbPromise, cutPlansP, cutItemsP, machinesP, leadsP, customersP, deliveriesP, profilesP, eventsP, knowledgeP, agentSessionsP, timeClockP, emailsP,
      ]);

      const cutPlans = cutPlansRes.data || [];
      const cutPlanItems = cutItemsRes.data || [];
      const machines = machinesRes.data || [];
      const leads = leadsRes.data || [];
      const customers = customersRes.data || [];
      const deliveries = deliveriesRes.data || [];
      const profiles = profilesRes.data || [];
      const events = eventsRes.data || [];
      const knowledge = (knowledgeRes.data || []) as { title: string; category: string; content: string | null }[];
      const agentSessions = (agentSessionsRes.data || []) as { id: string; title: string; agent_name: string; user_id: string; created_at: string }[];

      // Build agent activity summary: group by agent_name + user
      const profileMap = new Map<string, string>(profiles.map((p: any) => [p.user_id, p.full_name || "Unknown"]));
      const activityMap = new Map<string, { agent_name: string; session_count: number; last_topic: string; user_name: string }>();
      for (const s of agentSessions) {
        const key = `${s.agent_name}||${s.user_id}`;
        const existing = activityMap.get(key);
        if (existing) {
          existing.session_count++;
        } else {
          activityMap.set(key, {
            agent_name: s.agent_name,
            session_count: 1,
            last_topic: s.title,
            user_name: profileMap.get(s.user_id) || "Unknown",
          });
        }
      }
      const agentActivity = Array.from(activityMap.values());

      // Build team presence from time clock entries
      const timeClockEntries = (timeClockRes.data || []) as { id: string; profile_id: string; clock_in: string; clock_out: string | null }[];
      const profileIdMap = new Map<string, string>(profiles.map((p: any) => [p.id, p.full_name || "Unknown"]));
      const teamPresence = timeClockEntries.map((e) => ({
        name: profileIdMap.get(e.profile_id) || "Unknown",
        clocked_in: e.clock_in,
        clocked_out: e.clock_out,
      }));

      // Compute financials — use QB data if available, otherwise fall back to accounting_mirror
      let invoices = qbData?.invoices || [];
      let bills = qbData?.bills || [];
      let payments = qbData?.payments || [];
      let accounts = qbData?.accounts || [];

      // Fallback: if QB returned nothing, read from accounting_mirror (same source CEO Dashboard uses)
      if (!qbData) {
        const [mirrorInvRes, mirrorBillRes] = await Promise.all([
          supabase.from("accounting_mirror").select("balance, entity_type, data").eq("entity_type", "Invoice").gt("balance", 0),
          supabase.from("accounting_mirror").select("balance, entity_type, data").eq("entity_type", "Vendor").gt("balance", 0),
        ]);
        const mirrorInvoices = (mirrorInvRes.data || []).map((r: any) => ({
          Balance: r.balance,
          DueDate: (r.data as any)?.DueDate || null,
          CustomerRef: (r.data as any)?.CustomerRef || null,
          ...(r.data as any),
        }));
        const mirrorBills = (mirrorBillRes.data || []).map((r: any) => ({
          Balance: r.balance,
          DueDate: (r.data as any)?.DueDate || null,
          VendorRef: (r.data as any)?.VendorRef || null,
          ...(r.data as any),
        }));
        invoices = mirrorInvoices;
        bills = mirrorBills;
      }

      const todayDate = new Date().toISOString().split("T")[0];
      const overdueInvoices = invoices.filter((inv: any) => (inv.Balance || 0) > 0 && inv.DueDate && inv.DueDate < todayDate);
      const overdueBills = bills.filter((b: any) => (b.Balance || 0) > 0 && b.DueDate && b.DueDate < todayDate);
      const totalReceivable = invoices.reduce((sum: number, inv: any) => sum + (inv.Balance || 0), 0);
      const totalPayable = bills.reduce((sum: number, b: any) => sum + (b.Balance || 0), 0);

      const completedToday = cutPlanItems.filter(
        (i: any) => (i.completed_pieces ?? 0) >= (i.total_pieces ?? 0) && (i.total_pieces ?? 0) > 0
      ).length;

      const snap: VizzyBusinessSnapshot = {
        financials: {
          totalReceivable,
          totalPayable,
          overdueInvoices,
          overdueBills,
          accounts,
          payments,
          qbConnected: !!qbData,
        },
        production: {
          activeCutPlans: cutPlans.length,
          queuedItems: cutPlanItems.length,
          completedToday,
          machinesRunning: machines.length,
        },
        crm: {
          openLeads: leads.length,
          hotLeads: leads.filter((l: any) => (l.probability || 0) >= 70).slice(0, 5),
        },
        customers: { totalActive: customers.length },
        deliveries: {
          scheduledToday: deliveries.length,
          inTransit: deliveries.filter((dd: any) => dd.status === "in_transit").length,
        },
        team: { totalStaff: profiles.length },
        recentEvents: events,
        brainKnowledge: knowledge,
        agentActivity,
        teamPresence,
        inboundEmails: (emailsRes.data || []) as { subject: string; from_address: string; to_address: string; body_preview: string; received_at: string }[],
      };

      setSnapshot(snap);
      setLoading(false);
      return snap;
    } catch (err) {
      console.error("Vizzy context load error:", err);
      setLoading(false);
      return null;
    }
  }, []);

  return { loadFullContext, snapshot, loading };
}
