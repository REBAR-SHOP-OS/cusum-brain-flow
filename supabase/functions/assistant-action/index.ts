import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const BodySchema = z.object({
  source: z.literal("erp"),
  action: z.enum(["get_dashboard_stats", "list_machines", "list_production_tasks"]),
  params: z.record(z.unknown()).optional().default({}),
});

Deno.serve((req) =>
  handleRequest(req, async ({ body, serviceClient: supabase, log }) => {
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { action } = parsed.data;

    if (action === "get_dashboard_stats") {
      const [orders, customers, leads, machines, cutPlans] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("machines").select("*", { count: "exact", head: true }),
        supabase.from("cut_plans").select("*", { count: "exact", head: true }),
      ]);

      const stats = {
        orders: orders.count ?? 0,
        customers: customers.count ?? 0,
        leads: leads.count ?? 0,
        machines: machines.count ?? 0,
        cutPlans: cutPlans.count ?? 0,
      };

      log.done("Dashboard stats returned", stats);
      return {
        ok: true,
        spoken: `You have ${stats.orders} orders, ${stats.customers} customers, ${stats.leads} leads, ${stats.machines} machines, and ${stats.cutPlans} cut plans.`,
        cardTitle: "Dashboard Stats",
        data: stats,
      };
    }

    if (action === "list_machines") {
      const { data: machines, error } = await supabase
        .from("machines")
        .select("id, name, status, type")
        .order("name")
        .limit(20);

      if (error) throw new Error(error.message);

      const count = machines?.length ?? 0;
      log.done("Machines listed", { count });
      return {
        ok: true,
        spoken: count === 0
          ? "No machines found."
          : `Found ${count} machine${count > 1 ? "s" : ""}. ${machines!.slice(0, 3).map((m: any) => m.name).join(", ")}${count > 3 ? " and more" : ""}.`,
        cardTitle: "Machines",
        data: machines,
      };
    }

    if (action === "list_production_tasks") {
      const { data: tasks, error } = await supabase
        .from("production_tasks")
        .select("id, status, bar_code, task_type, qty")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw new Error(error.message);

      const count = tasks?.length ?? 0;
      log.done("Production tasks listed", { count });
      return {
        ok: true,
        spoken: count === 0
          ? "No production tasks found."
          : `Found ${count} production task${count > 1 ? "s" : ""}.`,
        cardTitle: "Production Tasks",
        data: tasks,
      };
    }

    return new Response(
      JSON.stringify({ ok: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }, { functionName: "assistant-action", authMode: "none", requireCompany: false, wrapResult: false })
);
