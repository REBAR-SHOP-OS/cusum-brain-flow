import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";

export interface HeartbeatData {
  visitors: {
    online: VisitorSession[];
    away: VisitorSession[];
    total: number;
  };
  team: {
    clockedIn: TeamMember[];
    totalStaff: number;
  };
  machines: MachineStatus[];
  conversations: { open: number };
  ordersToday: number;
  leadsToday: number;
  leadsBySource: { source: string; count: number }[];
  leadsByStage: { stage: string; count: number }[];
  visitorsByCity: { city: string; country: string; count: number }[];
  spending: {
    payables: number;
    receivables: number;
  };
  topCustomers: { name: string; total: number }[];
  production: {
    completedToday: number;
    totalTarget: number;
  };
  machineUtilization: { name: string; status: string; runMinutes: number }[];
  activityFeed: ActivityEvent[];
}

export interface VisitorSession {
  id: string;
  visitorName: string | null;
  city: string | null;
  country: string | null;
  currentPage: string | null;
  lastSeenAt: string | null;
  status: "online" | "away" | "offline";
}

export interface TeamMember {
  profileId: string;
  fullName: string;
  role: string | null;
  clockIn: string;
}

export interface MachineStatus {
  id: string;
  name: string;
  status: string;
  type: string;
  currentRunId: string | null;
}

export interface ActivityEvent {
  id: string;
  eventType: string;
  entityType: string;
  description: string | null;
  createdAt: string;
  source: string;
}

export function useBusinessHeartbeat() {
  const { companyId } = useCompanyId();

  return useQuery({
    queryKey: ["business-heartbeat", companyId],
    enabled: !!companyId,
    refetchInterval: 30000,
    queryFn: async (): Promise<HeartbeatData> => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
      const twentyFourHAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [
        convosRes,
        clockRes,
        profilesRes,
        machinesRes,
        openConvosRes,
        ordersTodayRes,
        leadsTodayRes,
        leadsAllRes,
        accountingRes,
        topCustRes,
        productionRes,
        activityRes,
      ] = await Promise.all([
        // 1. Visitor sessions (recent conversations with metadata)
        supabase
          .from("support_conversations")
          .select("id, visitor_name, metadata, updated_at")
          .eq("company_id", companyId!)
          .gte("updated_at", fiveMinAgo),

        // 2. Team clock entries today (clocked in, no clock_out)
        supabase
          .from("time_clock_entries")
          .select("id, profile_id, clock_in, clock_out")
          .gte("clock_in", todayStart)
          .is("clock_out", null),

        // 3. All profiles for team count
        supabase
          .from("profiles")
          .select("id, full_name, user_id")
          .eq("company_id", companyId!),

        // 4. Machines
        supabase
          .from("machines")
          .select("id, name, status, type, current_run_id")
          .eq("company_id", companyId!),

        // 5. Open conversations count
        supabase
          .from("support_conversations")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .in("status", ["open", "assigned", "pending"]),

        // 6. Orders today
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .gte("created_at", todayStart),

        // 7. Leads today
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId!)
          .gte("created_at", todayStart),

        // 8. All leads for source/stage breakdown
        supabase
          .from("leads")
          .select("source, stage")
          .eq("company_id", companyId!),

        // 9. Accounting mirror for AR/AP
        supabase
          .from("accounting_mirror")
          .select("entity_type, balance")
          .eq("company_id", companyId!)
          .in("entity_type", ["Invoice", "Vendor"]),

        // 10. Top customers by order value
        supabase
          .from("orders")
          .select("customer_id, total_amount, customers(name)")
          .eq("company_id", companyId!)
          .not("total_amount", "is", null)
          .order("total_amount", { ascending: false })
          .limit(20),

        // 11. Production today (cut plan items completed)
        supabase
          .from("cut_plan_items")
          .select("completed_pieces, total_pieces, cut_plan_id"),

        // 12. Activity feed last 24h
        supabase
          .from("activity_events")
          .select("id, event_type, entity_type, description, created_at, source")
          .eq("company_id", companyId!)
          .gte("created_at", twentyFourHAgo)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      // Parse visitors
      const nowMs = now.getTime();
      const sixtySecAgo = nowMs - 60 * 1000;
      const fiveMinAgoMs = nowMs - 5 * 60 * 1000;

      const visitors: VisitorSession[] = (convosRes.data || []).map((c) => {
        const meta = c.metadata as Record<string, any> | null;
        const lastSeen = meta?.last_seen_at ? new Date(meta.last_seen_at).getTime() : 0;
        let status: "online" | "away" | "offline" = "offline";
        if (lastSeen >= sixtySecAgo) status = "online";
        else if (lastSeen >= fiveMinAgoMs) status = "away";

        return {
          id: c.id,
          visitorName: c.visitor_name,
          city: meta?.city || null,
          country: meta?.country || null,
          currentPage: meta?.current_page || null,
          lastSeenAt: meta?.last_seen_at || null,
          status,
        };
      });

      // Parse visitor cities
      const cityMap = new Map<string, { city: string; country: string; count: number }>();
      visitors.forEach((v) => {
        if (v.city) {
          const key = v.city;
          const existing = cityMap.get(key);
          if (existing) existing.count++;
          else cityMap.set(key, { city: v.city, country: v.country || "", count: 1 });
        }
      });

      // Parse team
      const clockedInProfiles = (clockRes.data || []).map((entry) => {
        const profile = (profilesRes.data || []).find((p) => p.id === entry.profile_id);
        return {
          profileId: entry.profile_id,
          fullName: profile?.full_name || "Unknown",
          role: null as string | null,
          clockIn: entry.clock_in,
        };
      });

      // Parse leads by source/stage
      const sourceMap = new Map<string, number>();
      const stageMap = new Map<string, number>();
      (leadsAllRes.data || []).forEach((l) => {
        const src = l.source || "unknown";
        const stg = l.stage || "unknown";
        sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
        stageMap.set(stg, (stageMap.get(stg) || 0) + 1);
      });

      // Parse accounting
      let payables = 0;
      let receivables = 0;
      (accountingRes.data || []).forEach((a) => {
        if (a.entity_type === "Vendor") payables += Math.abs(a.balance || 0);
        if (a.entity_type === "Invoice") receivables += Math.abs(a.balance || 0);
      });

      // Parse top customers
      const custTotals = new Map<string, { name: string; total: number }>();
      (topCustRes.data || []).forEach((o: any) => {
        const name = o.customers?.name || "Unknown";
        const existing = custTotals.get(name);
        if (existing) existing.total += o.total_amount || 0;
        else custTotals.set(name, { name, total: o.total_amount || 0 });
      });
      const topCustomers = Array.from(custTotals.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      // Production
      let completedToday = 0;
      let totalTarget = 0;
      (productionRes.data || []).forEach((item) => {
        completedToday += item.completed_pieces || 0;
        totalTarget += item.total_pieces || 0;
      });

      // Machine utilization
      const machineUtil = (machinesRes.data || []).map((m) => ({
        name: m.name,
        status: m.status,
        runMinutes: m.status === "running" ? 60 : 0,
      }));

      return {
        visitors: {
          online: visitors.filter((v) => v.status === "online"),
          away: visitors.filter((v) => v.status === "away"),
          total: visitors.length,
        },
        team: {
          clockedIn: clockedInProfiles,
          totalStaff: (profilesRes.data || []).length,
        },
        machines: (machinesRes.data || []).map((m) => ({
          id: m.id,
          name: m.name,
          status: m.status,
          type: m.type,
          currentRunId: m.current_run_id,
        })),
        conversations: { open: openConvosRes.count || 0 },
        ordersToday: ordersTodayRes.count || 0,
        leadsToday: leadsTodayRes.count || 0,
        leadsBySource: Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count })),
        leadsByStage: Array.from(stageMap.entries()).map(([stage, count]) => ({ stage, count })),
        visitorsByCity: Array.from(cityMap.values()).sort((a, b) => b.count - a.count),
        spending: { payables, receivables },
        topCustomers,
        production: { completedToday, totalTarget },
        machineUtilization: machineUtil,
        activityFeed: (activityRes.data || []).map((e) => ({
          id: e.id,
          eventType: e.event_type,
          entityType: e.entity_type,
          description: e.description,
          createdAt: e.created_at,
          source: e.source,
        })),
      };
    },
  });
}
