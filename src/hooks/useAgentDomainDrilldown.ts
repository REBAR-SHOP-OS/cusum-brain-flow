import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "./useCompanyId";

export interface DrilldownRecord {
  label: string;
  sublabel?: string;
  status?: string;
}

interface DrilldownParams {
  agentCode: string | null;
  metricLabel: string | null;
}

export function useAgentDomainDrilldown({ agentCode, metricLabel }: DrilldownParams) {
  const { companyId } = useCompanyId();

  return useQuery({
    queryKey: ["agent_drilldown", companyId, agentCode, metricLabel],
    enabled: !!companyId && !!agentCode && !!metricLabel,
    staleTime: 30_000,
    queryFn: async (): Promise<DrilldownRecord[]> => {
      const cid = companyId!;
      const code = agentCode!;
      const metric = metricLabel!;

      // Tally (legal) — orders
      if (code === "legal") {
        let query = supabase
          .from("orders")
          .select("id, status, created_at")
          .eq("company_id", cid)
          .order("created_at", { ascending: false })
          .limit(100);

        if (metric === "Pending") {
          query = query.eq("status", "pending");
        }

        const { data } = await query;
        return (data || []).map((o: any) => ({
          label: `Order ${o.id.slice(0, 8)}`,
          sublabel: new Date(o.created_at).toLocaleDateString(),
          status: o.status,
        }));
      }

      // Blitz (sales) — leads
      if (code === "sales") {
        const activeStages = ["new", "prospecting", "qualified"];
        let query = supabase
          .from("leads")
          .select("id, customer_name, stage, created_at")
          .eq("company_id", cid)
          .order("created_at", { ascending: false })
          .limit(100);

        if (metric === "Active Leads") {
          query = query.in("stage", activeStages);
        } else if (metric === "Hot Enquiries") {
          query = query.eq("stage", "hot_enquiries");
        }

        const { data } = await query;
        return (data || []).map((l: any) => ({
          label: l.customer_name || `Lead ${l.id.slice(0, 8)}`,
          sublabel: new Date(l.created_at).toLocaleDateString(),
          status: l.stage,
        }));
      }

      // Penny (accounting) — invoices / AR
      if (code === "accounting") {
        if (metric === "Unpaid Invoices") {
          const { data } = await supabase
            .from("sales_invoices")
            .select("id, invoice_number, customer_name, status, amount, due_date")
            .eq("company_id", cid)
            .in("status", ["draft", "sent", "overdue"])
            .order("created_at", { ascending: false })
            .limit(100);
          return (data || []).map((inv: any) => ({
            label: inv.invoice_number || `INV-${inv.id.slice(0, 8)}`,
            sublabel: inv.customer_name || (inv.due_date ? `Due: ${new Date(inv.due_date).toLocaleDateString()}` : ""),
            status: inv.status,
          }));
        }
        if (metric === "Open AR") {
          const { data } = await supabase
            .from("accounting_mirror")
            .select("id, quickbooks_id, balance, entity_type")
            .eq("company_id", cid)
            .eq("entity_type", "invoice")
            .gt("balance", 0)
            .limit(100);
          return (data || []).map((ar: any) => ({
            label: `QB #${ar.quickbooks_id}`,
            sublabel: `Balance: $${Number(ar.balance).toLocaleString()}`,
            status: "open",
          }));
        }
      }

      // Gauge (estimating) — leads in estimation
      if (code === "estimating") {
        const estStages = ["estimation_ben", "estimation_karthick", "estimation_others", "estimation_partha"];
        const { data } = await supabase
          .from("leads")
          .select("id, customer_name, stage, created_at")
          .eq("company_id", cid)
          .in("stage", estStages)
          .order("created_at", { ascending: false })
          .limit(100);
        return (data || []).map((l: any) => ({
          label: l.customer_name || `Lead ${l.id.slice(0, 8)}`,
          sublabel: new Date(l.created_at).toLocaleDateString(),
          status: l.stage?.replace("estimation_", "Est: "),
        }));
      }

      // Forge (shopfloor) — machines / cut plans
      if (code === "shopfloor") {
        if (metric === "Machines") {
          const { data } = await supabase
            .from("machines")
            .select("id, name, type, status")
            .eq("company_id", cid)
            .limit(100);
          return (data || []).map((m: any) => ({
            label: m.name || `Machine ${m.id.slice(0, 8)}`,
            sublabel: m.type || "",
            status: m.status,
          }));
        }
        if (metric === "Active Cut Plans") {
          const { data } = await supabase
            .from("cut_plans")
            .select("id, name, status, created_at")
            .eq("company_id", cid)
            .in("status", ["pending", "in_progress"])
            .order("created_at", { ascending: false })
            .limit(100);
          return (data || []).map((cp: any) => ({
            label: cp.name || `Plan ${cp.id.slice(0, 8)}`,
            sublabel: new Date(cp.created_at).toLocaleDateString(),
            status: cp.status,
          }));
        }
      }

      // Atlas (bizdev) — won/qualified leads
      if (code === "bizdev") {
        let stage = "won";
        if (metric === "Qualified") stage = "qualified";
        const { data } = await supabase
          .from("leads")
          .select("id, customer_name, stage, created_at")
          .eq("company_id", cid)
          .eq("stage", stage)
          .order("created_at", { ascending: false })
          .limit(100);
        return (data || []).map((l: any) => ({
          label: l.customer_name || `Lead ${l.id.slice(0, 8)}`,
          sublabel: new Date(l.created_at).toLocaleDateString(),
          status: l.stage,
        }));
      }

      // Relay (delivery) — delivery pipeline leads
      if (code === "delivery") {
        if (metric === "Delivery Pipeline") {
          const { data } = await supabase
            .from("leads")
            .select("id, customer_name, stage, created_at")
            .eq("company_id", cid)
            .in("stage", ["out_for_delivery", "ready_to_dispatch", "delivered_pickup_done"])
            .order("created_at", { ascending: false })
            .limit(100);
          return (data || []).map((l: any) => ({
            label: l.customer_name || `Lead ${l.id.slice(0, 8)}`,
            sublabel: new Date(l.created_at).toLocaleDateString(),
            status: l.stage,
          }));
        }
        if (metric === "Bundles") {
          const { data } = await supabase
            .from("delivery_bundles")
            .select("id, created_at")
            .limit(100);
          return (data || []).map((b: any) => ({
            label: `Bundle ${b.id.slice(0, 8)}`,
            sublabel: new Date(b.created_at).toLocaleDateString(),
          }));
        }
      }

      // Pixel (social)
      if (code === "social") {
        const { data } = await supabase
          .from("social_posts")
          .select("id, created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        return (data || []).map((p: any) => ({
          label: `Post ${p.id.slice(0, 8)}`,
          sublabel: new Date(p.created_at).toLocaleDateString(),
        }));
      }

      // Rex (data) — AI calls
      if (code === "data") {
        const { data } = await supabase
          .from("ai_execution_log")
          .select("id, model, status, created_at, agent_name")
          .gte("created_at", new Date(Date.now() - 86400000).toISOString())
          .order("created_at", { ascending: false })
          .limit(100);
        return (data || []).map((log: any) => ({
          label: log.agent_name || log.model,
          sublabel: new Date(log.created_at).toLocaleTimeString(),
          status: log.status,
        }));
      }

      // Haven (support) / Vizzy (assistant) — suggestions
      if (code === "support" || code === "assistant") {
        let query = supabase
          .from("suggestions")
          .select("id, suggestion_type, title, status, created_at")
          .in("status", ["pending", "shown"])
          .order("created_at", { ascending: false })
          .limit(100);

        if (code === "assistant" && metric === "Open Warnings") {
          query = query.eq("suggestion_type", "warning");
        }

        const { data } = await query;
        return (data || []).map((s: any) => ({
          label: s.title || `Suggestion ${s.id.slice(0, 8)}`,
          sublabel: new Date(s.created_at).toLocaleDateString(),
          status: s.suggestion_type || s.status,
        }));
      }

      return [];
    },
  });
}
