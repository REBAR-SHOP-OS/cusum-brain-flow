import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth guard: only admins can trigger suggestion generation
    const { userId, serviceClient: supabase } = await requireAuth(req);

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) {
      return json({ error: "Admin role required" }, 403);
    }

    // Load agent IDs
    const { data: agents } = await supabase.from("agents").select("id, code");
    if (!agents || agents.length === 0) {
      return json({ error: "No agents found" }, 500);
    }

    const agentMap = Object.fromEntries(agents.map((a: any) => [a.code, a.id]));
    const now = new Date();
    const suggestions: any[] = [];
    const humanTasks: any[] = [];

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

    // Also check existing human_tasks dedupe keys
    const existingTaskKeys = new Set<string>();
    const { data: existingTasks } = await supabase
      .from("human_tasks")
      .select("dedupe_key")
      .in("status", ["open", "snoozed"])
      .not("dedupe_key", "is", null);

    if (existingTasks) {
      existingTasks.forEach((t: any) => {
        if (t.dedupe_key) existingTaskKeys.add(t.dedupe_key);
      });
    }

    const isDuplicate = (entityType: string, entityId: string, category: string) =>
      existingSuggestions.has(`${entityType}:${entityId}:${category}`);

    const isTaskDupe = (key: string) => existingTaskKeys.has(key);

    // Helper to push both suggestion + human_task
    function pushDual(suggestionRow: any, taskDedupeKey: string, agentId: string, sourceEventId?: string) {
      suggestions.push(suggestionRow);

      if (!isTaskDupe(taskDedupeKey)) {
        humanTasks.push({
          company_id: suggestionRow.company_id,
          agent_id: agentId,
          source_event_id: sourceEventId || null,
          dedupe_key: taskDedupeKey,
          title: suggestionRow.title,
          description: suggestionRow.description,
          severity: suggestionRow.severity,
          category: suggestionRow.category,
          entity_type: suggestionRow.entity_type,
          entity_id: suggestionRow.entity_id,
          inputs_snapshot: {
            generated_at: now.toISOString(),
            reason: suggestionRow.reason,
            impact: suggestionRow.impact,
          },
          status: "open",
          actions: suggestionRow.actions,
          reason: suggestionRow.reason,
          impact: suggestionRow.impact,
        });
      }
    }

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
          if (isDuplicate("invoice", inv.id, "overdue_ar")) continue;

          const customerName = invData?.CustomerRef?.name ?? "Unknown";
          const row = {
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
            actions: [
              { label: "View AR", action: "navigate", path: "/accounting?tab=invoices" },
            ],
          };
          pushDual(row, `vizzy:overdue_ar:${inv.id}`, agentMap.vizzy);
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
          const row = {
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
            actions: [
              { label: "View Order", action: "navigate", path: `/orders` },
            ],
          };
          pushDual(row, `vizzy:zero_total:${order.id}`, agentMap.vizzy);
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
          const row = {
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
            actions: [
              { label: "View Customer", action: "navigate", path: "/customers" },
            ],
          };
          pushDual(row, `penny:missing_qb:${cust.id}`, agentMap.penny);
        }
      }

      // Penny-specific AR aging (30/60/90 day tiers)
      const { data: pennyOverdue } = await supabase
        .from("accounting_mirror")
        .select("id, company_id, quickbooks_id, data, balance, customer_id")
        .eq("entity_type", "Invoice")
        .gt("balance", 0);

      if (pennyOverdue) {
        for (const inv of pennyOverdue) {
          const invData = inv.data as any;
          const dueDate = invData?.DueDate ? new Date(invData.DueDate) : null;
          if (!dueDate || dueDate >= now) continue;
          if (!inv.company_id) continue;

          const daysPast = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
          if (daysPast < 30) continue;

          const severity = daysPast >= 90 ? "critical" : daysPast >= 60 ? "warning" : "info";
          if (isDuplicate("invoice", inv.id, "penny_overdue_ar")) continue;

          const customerName = invData?.CustomerRef?.name ?? "Unknown";
          const tier = daysPast >= 90 ? "90+" : daysPast >= 60 ? "60-89" : "30-59";
          const row = {
            company_id: inv.company_id,
            agent_id: agentMap.penny,
            suggestion_type: "action",
            category: "penny_overdue_ar",
            title: `${customerName} — $${inv.balance?.toFixed(0)} overdue (${tier}d)`,
            description: `Invoice ${invData?.DocNumber ?? inv.quickbooks_id} is ${daysPast} days past due. ${tier}-day aging tier.`,
            severity,
            reason: `This invoice was due ${dueDate.toLocaleDateString()} and remains unpaid. Aging tier: ${tier} days.`,
            impact: `$${inv.balance?.toFixed(2)} at risk`,
            entity_type: "invoice",
            entity_id: inv.id,
            status: "open",
            actions: [
              { label: "View Invoice", action: "navigate", path: "/accounting?tab=invoices" },
            ],
          };
          pushDual(row, `penny:overdue_ar:${inv.id}:${tier}`, agentMap.penny);
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
            const row = {
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
              actions: [
                { label: "View Machine", action: "navigate", path: "/shop-floor" },
              ],
            };
            pushDual(row, `forge:idle_backlog:${machine.id}`, agentMap.forge);
          }
        }

        // Bender starving
        const cutterMachines = machines.filter((m: any) => m.type === "cutter");
        const benderMachines = machines.filter((m: any) => m.type === "bender");
        const cutterQueued = cutterMachines.reduce((sum: number, m: any) => sum + (queuedByMachine.get(m.id) ?? 0), 0);
        const benderQueued = benderMachines.reduce((sum: number, m: any) => sum + (queuedByMachine.get(m.id) ?? 0), 0);

        if (cutterQueued > 5 && benderQueued === 0 && benderMachines.length > 0) {
          const firstBender = benderMachines[0] as any;
          if (!isDuplicate("machine", firstBender.id, "bender_starving")) {
            const row = {
              company_id: firstBender.company_id,
              agent_id: agentMap.forge,
              suggestion_type: "action",
              category: "bender_starving",
              title: `Benders starving — ${cutterQueued} cuts queued, 0 bends`,
              description: `Cutters have ${cutterQueued} queued plans but benders have nothing. Downstream bottleneck forming.`,
              severity: "warning",
              reason: "Cut output is piling up with no bending work scheduled. This creates a production imbalance.",
              impact: `${cutterQueued} cut plans with no downstream bending`,
              entity_type: "machine",
              entity_id: firstBender.id,
              status: "open",
              actions: [
                { label: "View Shop Floor", action: "navigate", path: "/shop-floor" },
              ],
            };
            pushDual(row, `forge:bender_starving:${firstBender.id}`, agentMap.forge);
          }
        }
      }

      // At-risk jobs: cut plans with low completion
      const { data: atRiskPlans } = await supabase
        .from("cut_plans")
        .select("id, name, company_id, status, project_name, created_at")
        .in("status", ["queued", "in_progress"]);

      if (atRiskPlans) {
        for (const plan of atRiskPlans) {
          if (!plan.company_id) continue;
          const { data: items } = await supabase
            .from("cut_plan_items")
            .select("total_pieces, completed_pieces")
            .eq("cut_plan_id", plan.id);

          if (!items || items.length === 0) continue;
          const totalPieces = items.reduce((s: number, i: any) => s + (i.total_pieces ?? 0), 0);
          const completedPieces = items.reduce((s: number, i: any) => s + (i.completed_pieces ?? 0), 0);
          if (totalPieces === 0) continue;
          const completionPct = (completedPieces / totalPieces) * 100;

          if (plan.status === "in_progress" && completionPct < 50) {
            if (isDuplicate("cut_plan", plan.id, "at_risk_job")) continue;
            const row = {
              company_id: plan.company_id,
              agent_id: agentMap.forge,
              suggestion_type: "action",
              category: "at_risk_job",
              title: `${plan.name} at risk — ${completionPct.toFixed(0)}% done`,
              description: `Cut plan "${plan.name}" is in progress but only ${completionPct.toFixed(0)}% complete.`,
              severity: completionPct < 25 ? "critical" : "warning",
              reason: "This job is actively running but completion is significantly behind. May miss delivery targets.",
              impact: `${totalPieces - completedPieces} pieces remaining`,
              entity_type: "cut_plan",
              entity_id: plan.id,
              status: "open",
              actions: [
                { label: "View Shop Floor", action: "navigate", path: "/shop-floor" },
              ],
            };
            pushDual(row, `forge:at_risk:${plan.id}`, agentMap.forge);
          }
        }
      }
    }

    // Batch insert suggestions (backward compat)
    if (suggestions.length > 0) {
      const { error: insertError } = await supabase.from("suggestions").insert(suggestions);
      if (insertError) {
        console.error("Failed to insert suggestions:", insertError);
      }
    }

    // Batch insert human_tasks with ON CONFLICT dedupe
    let tasksInserted = 0;
    if (humanTasks.length > 0) {
      // Use upsert with ignoreDuplicates to handle dedupe_key conflicts
      const { data: insertedTasks, error: taskError } = await supabase
        .from("human_tasks")
        .upsert(humanTasks, { onConflict: "dedupe_key", ignoreDuplicates: true })
        .select("id");

      if (taskError) {
        console.error("Failed to insert human_tasks:", taskError);
      } else {
        tasksInserted = insertedTasks?.length ?? 0;
      }
    }

    return new Response(
      JSON.stringify({
        generated: suggestions.length,
        human_tasks_created: tasksInserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("generate-suggestions error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
