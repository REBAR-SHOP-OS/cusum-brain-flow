import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load agent IDs
    const { data: agents } = await supabase.from("agents").select("id, code");
    if (!agents || agents.length === 0) {
      return new Response(JSON.stringify({ error: "No agents found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agentMap = Object.fromEntries(agents.map((a: any) => [a.code, a.id]));
    const now = new Date();
    const suggestions: any[] = [];

    // Helper: check if suggestion already exists (dedup)
    const existingSuggestions = new Set<string>();
    const { data: existingOpen } = await supabase
      .from("suggestions")
      .select("entity_type, entity_id, category")
      .in("status", ["open", "new"])
      .not("entity_type", "is", null);

    if (existingOpen) {
      existingOpen.forEach((s: any) => {
        existingSuggestions.add(`${s.entity_type}:${s.entity_id}:${s.category}`);
      });
    }

    const isDuplicate = (entityType: string, entityId: string, category: string) =>
      existingSuggestions.has(`${entityType}:${entityId}:${category}`);

    // ========== VIZZY (CEO) ==========
    if (agentMap.vizzy) {
      // Overdue invoices from accounting_mirror
      const { data: overdueInvoices } = await supabase
        .from("accounting_mirror")
        .select("id, company_id, quickbooks_id, data, balance, customer_id")
        .eq("entity_type", "Invoice")
        .gt("balance", 0);

      if (overdueInvoices) {
        for (const inv of overdueInvoices) {
          const invData = inv.data as any;
          const dueDate = invData?.DueDate ? new Date(invData.DueDate) : null;
          if (!dueDate || dueDate >= now) continue;
          if (!inv.company_id) continue;

          const daysPast = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
          const severity = daysPast > 90 ? "critical" : daysPast > 30 ? "warning" : "info";
          const key = `invoice:${inv.id}:overdue_ar`;
          if (isDuplicate("invoice", inv.id, "overdue_ar")) continue;

          const customerName = invData?.CustomerRef?.name ?? "Unknown";
          suggestions.push({
            company_id: inv.company_id,
            agent_id: agentMap.vizzy,
            suggestion_type: "action",
            category: "overdue_ar",
            title: `${customerName} — $${inv.balance?.toFixed(0)} overdue (${daysPast}d)`,
            description: `Invoice ${invData?.DocNumber ?? inv.quickbooks_id} is ${daysPast} days past due.`,
            severity,
            reason: `This invoice was due ${dueDate.toLocaleDateString()} and remains unpaid. AR aging increases bad debt risk.`,
            impact: `$${inv.balance?.toFixed(2)} at risk`,
            entity_type: "invoice",
            entity_id: inv.id,
            status: "open",
            actions: JSON.stringify([
              { label: "View AR", action: "navigate", path: "/accounting?tab=invoices" },
            ]),
          });
        }
      }

      // $0 orders blocking invoicing
      const { data: zeroOrders } = await supabase
        .from("orders")
        .select("id, company_id, order_number, customer_id, total_amount, status")
        .eq("total_amount", 0)
        .in("status", ["confirmed", "in_production"]);

      if (zeroOrders) {
        for (const order of zeroOrders) {
          if (isDuplicate("order", order.id, "zero_total")) continue;
          if (!order.company_id) continue;
          suggestions.push({
            company_id: order.company_id,
            agent_id: agentMap.vizzy,
            suggestion_type: "action",
            category: "zero_total",
            title: `Order ${order.order_number} has $0 total`,
            description: "This order has no line items priced, blocking invoicing.",
            severity: "warning",
            reason: "Orders with $0 total cannot be invoiced. Production may be running without revenue capture.",
            impact: "Revenue leakage",
            entity_type: "order",
            entity_id: order.id,
            status: "open",
            actions: JSON.stringify([
              { label: "View Order", action: "navigate", path: `/orders` },
            ]),
          });
        }
      }
    }

    // ========== PENNY (Accounting) ==========
    if (agentMap.penny) {
      // Customers missing QuickBooks ID
      const { data: missingQb } = await supabase
        .from("customers")
        .select("id, name, company_id")
        .is("quickbooks_id", null)
        .eq("status", "active")
        .not("company_id", "is", null)
        .limit(10);

      if (missingQb) {
        for (const cust of missingQb) {
          if (isDuplicate("customer", cust.id, "missing_qb")) continue;
          suggestions.push({
            company_id: (cust as any).company_id,
            agent_id: agentMap.penny,
            suggestion_type: "action",
            category: "missing_qb",
            title: `${cust.name} has no QuickBooks ID`,
            description: "This customer cannot be synced to QuickBooks for invoicing.",
            severity: "warning",
            reason: "Without a QuickBooks link, invoices created for this customer won't sync to your accounting system.",
            entity_type: "customer",
            entity_id: cust.id,
            status: "open",
            actions: JSON.stringify([
              { label: "View Customer", action: "navigate", path: "/customers" },
            ]),
          });
        }
      }
    }

    // ========== FORGE (Shop Floor) ==========
    if (agentMap.forge) {
      // Idle machines with queued backlog
      const { data: machines } = await supabase
        .from("machines")
        .select("id, name, status, company_id, type");

      const { data: queuedPlans } = await supabase
        .from("cut_plans")
        .select("id, machine_id, status")
        .eq("status", "queued");

      if (machines && queuedPlans) {
        const queuedByMachine = new Map<string, number>();
        for (const cp of queuedPlans) {
          if (cp.machine_id) {
            queuedByMachine.set(cp.machine_id, (queuedByMachine.get(cp.machine_id) ?? 0) + 1);
          }
        }

        for (const machine of machines) {
          if (machine.status === "idle" && (queuedByMachine.get(machine.id) ?? 0) > 0) {
            if (isDuplicate("machine", machine.id, "idle_with_backlog")) continue;
            const queueCount = queuedByMachine.get(machine.id)!;
            suggestions.push({
              company_id: machine.company_id,
              agent_id: agentMap.forge,
              suggestion_type: "action",
              category: "idle_with_backlog",
              title: `${machine.name} idle with ${queueCount} queued plans`,
              description: `Machine is idle but has ${queueCount} cut plan(s) waiting.`,
              severity: "warning",
              reason: "Production time is being wasted while work is queued.",
              impact: `${queueCount} plans delayed`,
              entity_type: "machine",
              entity_id: machine.id,
              status: "open",
              actions: JSON.stringify([
                { label: "View Machine", action: "navigate", path: "/shop-floor" },
              ]),
            });
          }
        }
      }
    }

    // Batch insert all suggestions
    if (suggestions.length > 0) {
      const { error: insertError } = await supabase.from("suggestions").insert(suggestions);
      if (insertError) {
        console.error("Failed to insert suggestions:", insertError);
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ generated: suggestions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-suggestions error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
