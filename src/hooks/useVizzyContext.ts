import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuickBooksData } from "@/hooks/useQuickBooksData";

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
  const qb = useQuickBooksData();
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<VizzyBusinessSnapshot | null>(null);
  const loadedRef = useRef(false);

  const loadFullContext = useCallback(async (): Promise<VizzyBusinessSnapshot | null> => {
    if (loadedRef.current && snapshot) return snapshot;
    loadedRef.current = true;
    setLoading(true);

    try {
      const qbPromise = qb.loadAll().catch(() => {});

      const today = new Date().toISOString().split("T")[0];
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

      const [cutPlansRes, cutItemsRes, machinesRes, leadsRes, customersRes, deliveriesRes, profilesRes, eventsRes] = await Promise.all([
        cutPlansP, cutItemsP, machinesP, leadsP, customersP, deliveriesP, profilesP, eventsP,
      ]);

      await qbPromise;

      const cutPlans = cutPlansRes.data || [];
      const cutPlanItems = cutItemsRes.data || [];
      const machines = machinesRes.data || [];
      const leads = leadsRes.data || [];
      const customers = customersRes.data || [];
      const deliveries = deliveriesRes.data || [];
      const profiles = profilesRes.data || [];
      const events = eventsRes.data || [];

      const completedToday = cutPlanItems.filter(
        (i: any) => (i.completed_pieces ?? 0) >= (i.total_pieces ?? 0) && (i.total_pieces ?? 0) > 0
      ).length;

      const snap: VizzyBusinessSnapshot = {
        financials: {
          totalReceivable: qb.totalReceivable,
          totalPayable: qb.totalPayable,
          overdueInvoices: qb.overdueInvoices,
          overdueBills: qb.overdueBills,
          accounts: qb.accounts,
          payments: qb.payments,
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
  }, [qb, snapshot]);

  return { loadFullContext, snapshot, loading };
}
