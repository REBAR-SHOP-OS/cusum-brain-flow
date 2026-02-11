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
      const leadsP = (supabase.from("leads").select("id, contact_name, company_name, status, expected_revenue, lead_score") as any)
        .in("status", ["new", "contacted", "qualified", "proposal"])
        .order("lead_score", { ascending: false }).limit(20);
      const customersP = supabase.from("customers").select("id, name, status").eq("status", "active").limit(100) as any;
      const deliveriesP = supabase.from("deliveries").select("id, delivery_number, status, scheduled_date")
        .gte("scheduled_date", today).lte("scheduled_date", today).limit(50) as any;
      const profilesP = supabase.from("profiles").select("id, full_name").not("full_name", "is", null) as any;
      const eventsP = supabase.from("events").select("id, event_type, entity_type, description, created_at")
        .order("created_at", { ascending: false }).limit(20) as any;

      const [qbData, cutPlansRes, cutItemsRes, machinesRes, leadsRes, customersRes, deliveriesRes, profilesRes, eventsRes] = await Promise.all([
        qbPromise, cutPlansP, cutItemsP, machinesP, leadsP, customersP, deliveriesP, profilesP, eventsP,
      ]);

      const cutPlans = cutPlansRes.data || [];
      const cutPlanItems = cutItemsRes.data || [];
      const machines = machinesRes.data || [];
      const leads = leadsRes.data || [];
      const customers = customersRes.data || [];
      const deliveries = deliveriesRes.data || [];
      const profiles = profilesRes.data || [];
      const events = eventsRes.data || [];

      // Compute financials directly from raw QB data (no React state dependency)
      const invoices = qbData?.invoices || [];
      const bills = qbData?.bills || [];
      const payments = qbData?.payments || [];
      const accounts = qbData?.accounts || [];

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
        },
        production: {
          activeCutPlans: cutPlans.length,
          queuedItems: cutPlanItems.length,
          completedToday,
          machinesRunning: machines.length,
        },
        crm: {
          openLeads: leads.length,
          hotLeads: leads.filter((l: any) => (l.lead_score || 0) >= 70).slice(0, 5),
        },
        customers: { totalActive: customers.length },
        deliveries: {
          scheduledToday: deliveries.length,
          inTransit: deliveries.filter((dd: any) => dd.status === "in_transit").length,
        },
        team: { totalStaff: profiles.length },
        recentEvents: events,
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
