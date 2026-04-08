import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";

export interface AgentDomainStat {
  label: string;
  value: number;
}

export type AgentDomainStatsMap = Record<string, AgentDomainStat[]>;

export function useAgentDomainStats() {
  const { companyId } = useCompanyId();

  return useQuery({
    queryKey: ["agent_domain_stats", companyId],
    enabled: !!companyId,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<AgentDomainStatsMap> => {
      const cid = companyId!;
      const stats: AgentDomainStatsMap = {};

      const [
        leadsRes,
        invoicesRes,
        mirrorRes,
        ordersRes,
        suggestionsRes,
        socialRes,
        machinesRes,
        cutPlansRes,
        aiLogRes,
        deliveryRes,
      ] = await Promise.all([
        // Leads — for Blitz, Gauge, Atlas, Relay
        supabase
          .from("leads")
          .select("stage", { count: "exact", head: false })
          .eq("company_id", cid)
          .in("stage", [
            "new", "prospecting", "qualified", "hot_enquiries",
            "estimation_ben", "estimation_karthick", "estimation_others", "estimation_partha",
            "won", "delivered_pickup_done", "out_for_delivery", "ready_to_dispatch",
          ]),

        // Sales invoices — for Penny
        supabase
          .from("sales_invoices")
          .select("status", { count: "exact", head: false })
          .eq("company_id", cid)
          .in("status", ["draft", "sent", "overdue"]),

        // Accounting mirror — for Penny
        supabase
          .from("accounting_mirror")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .eq("entity_type", "invoice")
          .gt("balance", 0),

        // Orders — for Tally
        supabase
          .from("orders")
          .select("status", { count: "exact", head: false })
          .eq("company_id", cid),

        // Suggestions — for Haven, Vizzy
        supabase
          .from("suggestions")
          .select("suggestion_type", { count: "exact", head: false })
          .in("status", ["pending", "shown"]),

        // Social posts — for Pixel
        supabase
          .from("social_posts")
          .select("id", { count: "exact", head: true }),

        // Machines — for Forge
        supabase
          .from("machines")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid),

        // Cut plans — for Forge
        supabase
          .from("cut_plans")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .in("status", ["pending", "in_progress"]),

        // AI execution log — for Rex
        supabase
          .from("ai_execution_log")
          .select("id", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 86400000).toISOString()),

        // Delivery bundles — for Relay
        supabase
          .from("delivery_bundles")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid),
      ]);

      // Blitz (Sales)
      const leads = leadsRes.data || [];
      const activeLeads = leads.filter(l =>
        ["new", "prospecting", "qualified"].includes(l.stage)
      ).length;
      const hotLeads = leads.filter(l => l.stage === "hot_enquiries").length;
      stats["sales"] = [
        { label: "Active Leads", value: activeLeads },
        { label: "Hot Enquiries", value: hotLeads },
      ];

      // Penny (Accounting)
      const unpaidInvoices = (invoicesRes.data || []).length;
      const openAR = mirrorRes.count ?? 0;
      stats["accounting"] = [
        { label: "Unpaid Invoices", value: unpaidInvoices },
        { label: "Open AR", value: openAR },
      ];

      // Tally (Legal)
      const allOrders = ordersRes.data || [];
      const pendingOrders = allOrders.filter(o => o.status === "pending").length;
      stats["legal"] = [
        { label: "Total Orders", value: allOrders.length },
        { label: "Pending", value: pendingOrders },
      ];

      // Haven (Support)
      const openSuggestions = (suggestionsRes.data || []).length;
      stats["support"] = [
        { label: "Open Suggestions", value: openSuggestions },
      ];

      // Pixel (Social)
      stats["social"] = [
        { label: "Total Posts", value: socialRes.count ?? 0 },
      ];

      // Gauge (Estimating)
      const estimationLeads = leads.filter(l =>
        ["estimation_ben", "estimation_karthick", "estimation_others", "estimation_partha"].includes(l.stage)
      ).length;
      stats["estimating"] = [
        { label: "In Estimation", value: estimationLeads },
      ];

      // Forge (Shop Floor)
      stats["shopfloor"] = [
        { label: "Machines", value: machinesRes.count ?? 0 },
        { label: "Active Cut Plans", value: cutPlansRes.count ?? 0 },
      ];

      // Atlas (BizDev)
      const wonLeads = leads.filter(l => l.stage === "won").length;
      const qualifiedLeads = leads.filter(l => l.stage === "qualified").length;
      stats["bizdev"] = [
        { label: "Won", value: wonLeads },
        { label: "Qualified", value: qualifiedLeads },
      ];

      // Relay (Delivery)
      const deliveryLeads = leads.filter(l =>
        ["out_for_delivery", "ready_to_dispatch", "delivered_pickup_done"].includes(l.stage)
      ).length;
      stats["delivery"] = [
        { label: "Delivery Pipeline", value: deliveryLeads },
        { label: "Bundles", value: deliveryRes.count ?? 0 },
      ];

      // Rex (Data)
      stats["data"] = [
        { label: "AI Calls (24h)", value: aiLogRes.count ?? 0 },
      ];

      // Vizzy (Commander)
      const warnings = (suggestionsRes.data || []).filter(s => s.suggestion_type === "warning").length;
      stats["assistant"] = [
        { label: "Open Warnings", value: warnings },
        { label: "Total Open", value: openSuggestions },
      ];

      return stats;
    },
  });
}
