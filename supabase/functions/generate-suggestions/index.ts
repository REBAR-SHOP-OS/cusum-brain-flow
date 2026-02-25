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

    // Clean up stale missing_qb suggestions & tasks so they get recreated fresh
    await supabase.from("suggestions").delete().eq("category", "missing_qb").in("status", ["open", "new"]);
    await supabase.from("human_tasks").delete().eq("category", "missing_qb").in("status", ["open", "snoozed"]);
    // Remove missing_qb entries from dedup sets
    for (const key of existingSuggestions) {
      if (key.endsWith(":missing_qb")) existingSuggestions.delete(key);
    }
    for (const key of existingTaskKeys) {
      if (key.includes(":missing_qb:")) existingTaskKeys.delete(key);
    }

    // ========== AUTO-RESOLVE stale suggestions ==========
    // Close invoice suggestions where balance is now 0 or invoice deleted
    const { data: openInvoiceSuggestions } = await supabase
      .from("suggestions")
      .select("id, entity_id")
      .in("status", ["open", "new"])
      .eq("entity_type", "invoice");

    if (openInvoiceSuggestions && openInvoiceSuggestions.length > 0) {
      const entityIds = openInvoiceSuggestions.map((s: any) => s.entity_id).filter(Boolean);
      const { data: currentInvoices } = await supabase
        .from("accounting_mirror")
        .select("id, balance")
        .in("id", entityIds);

      const balanceMap = new Map((currentInvoices || []).map((i: any) => [i.id, i.balance]));
      const toResolveInv: string[] = [];
      const toResolveInvEntityIds: string[] = [];

      for (const s of openInvoiceSuggestions) {
        const balance = balanceMap.get(s.entity_id);
        if (balance === undefined || balance === null || balance < 2) {
          toResolveInv.push(s.id);
          if (s.entity_id) toResolveInvEntityIds.push(s.entity_id);
        }
      }

      if (toResolveInv.length > 0) {
        await supabase
          .from("suggestions")
          .update({ status: "resolved", resolved_at: now.toISOString() })
          .in("id", toResolveInv);
        // Also resolve matching human_tasks
        if (toResolveInvEntityIds.length > 0) {
          await supabase
            .from("human_tasks")
            .update({ status: "resolved", resolved_at: now.toISOString() })
            .eq("entity_type", "invoice")
            .in("entity_id", toResolveInvEntityIds)
            .in("status", ["open", "snoozed"]);
        }
        console.log(`Auto-resolved ${toResolveInv.length} stale invoice suggestions`);
        // Remove resolved from dedup sets so we don't skip fresh re-generation
        for (const s of openInvoiceSuggestions) {
          if (toResolveInv.includes(s.id)) {
            existingSuggestions.delete(`invoice:${s.entity_id}:overdue_ar`);
            existingSuggestions.delete(`invoice:${s.entity_id}:penny_overdue_ar`);
          }
        }
      }
    }

    // Close order suggestions where order is now completed/cancelled/delivered
    const { data: openOrderSuggestions } = await supabase
      .from("suggestions")
      .select("id, entity_id")
      .in("status", ["open", "new"])
      .eq("entity_type", "order");

    if (openOrderSuggestions && openOrderSuggestions.length > 0) {
      const orderIds = openOrderSuggestions.map((s: any) => s.entity_id).filter(Boolean);
      const { data: currentOrders } = await supabase
        .from("orders")
        .select("id, status")
        .in("id", orderIds);

      const statusMap = new Map((currentOrders || []).map((o: any) => [o.id, o.status]));
      const toResolveOrd: string[] = [];
      const toResolveOrdEntityIds: string[] = [];

      for (const s of openOrderSuggestions) {
        const status = statusMap.get(s.entity_id);
        if (status === undefined || ["completed", "cancelled", "delivered"].includes(status)) {
          toResolveOrd.push(s.id);
          if (s.entity_id) toResolveOrdEntityIds.push(s.entity_id);
        }
      }

      if (toResolveOrd.length > 0) {
        await supabase
          .from("suggestions")
          .update({ status: "resolved", resolved_at: now.toISOString() })
          .in("id", toResolveOrd);
        if (toResolveOrdEntityIds.length > 0) {
          await supabase
            .from("human_tasks")
            .update({ status: "resolved", resolved_at: now.toISOString() })
            .eq("entity_type", "order")
            .in("entity_id", toResolveOrdEntityIds)
            .in("status", ["open", "snoozed"]);
        }
        console.log(`Auto-resolved ${toResolveOrd.length} stale order suggestions`);
        for (const s of openOrderSuggestions) {
          if (toResolveOrd.includes(s.id)) {
            for (const key of existingSuggestions) {
              if (key.startsWith(`order:${s.entity_id}:`)) existingSuggestions.delete(key);
            }
          }
        }
      }
    }
    // ========== END AUTO-RESOLVE ==========

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

    // ========== Pre-load customer name map for invoice lookups ==========
    const customerNameMap = new Map<string, string>();
    const { data: allCustomers } = await supabase.from("customers").select("id, name");
    if (allCustomers) {
      for (const c of allCustomers) customerNameMap.set(c.id, c.name);
    }

    // Helper to resolve customer name from accounting_mirror row
    const resolveCustomerName = (inv: any) => {
      // First try our customers table via customer_id FK
      if (inv.customer_id && customerNameMap.has(inv.customer_id)) {
        return customerNameMap.get(inv.customer_id)!;
      }
      // Fallback to QuickBooks embedded data
      const invData = inv.data as any;
      return invData?.CustomerName ?? invData?.CustomerRef?.name ?? "Unknown";
    };

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

          const customerName = resolveCustomerName(inv);
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
              { label: "View Invoice", action: "navigate", path: `/customer-action/${inv.customer_id || "unknown"}?invoice=${inv.id}` },
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
              { label: "View Order", action: "navigate", path: `/accounting?tab=orders&search=${encodeURIComponent(order.order_number)}` },
            ],
          };
          pushDual(row, `vizzy:zero_total:${order.id}`, agentMap.vizzy);
        }
      }

      // Jobs blocked by revision / change order
      const { data: blockedByRevision } = await supabase
        .from("orders")
        .select("id, order_number, company_id, customer_revision_count, pending_change_order, production_locked, shop_drawing_status")
        .eq("production_locked", true)
        .in("status", ["confirmed", "in_production"]);

      if (blockedByRevision) {
        for (const order of blockedByRevision) {
          if (!order.company_id || isDuplicate("order", order.id, "blocked_production")) continue;
          const reasons: string[] = [];
          if (order.shop_drawing_status !== "approved") reasons.push("shop drawing not approved");
          if (order.pending_change_order) reasons.push("pending change order");
          const row = {
            company_id: order.company_id,
            agent_id: agentMap.vizzy,
            suggestion_type: "action",
            category: "blocked_production",
            title: `${order.order_number} — production blocked`,
            description: `Reasons: ${reasons.join(", ") || "safety lock active"}.`,
            severity: "critical",
            reason: `Order cannot enter cutting. ${order.customer_revision_count} revision(s) recorded.`,
            impact: "Revenue delayed",
            entity_type: "order",
            entity_id: order.id,
            status: "open",
            actions: [{ label: "View Order", action: "navigate", path: `/accounting?tab=orders&search=${encodeURIComponent(order.order_number)}` }],
          };
          pushDual(row, `vizzy:blocked:${order.id}`, agentMap.vizzy);
        }
      }

      // Revenue waiting on QC/Delivery
      const { data: revenueHeldOrders } = await supabase
        .from("orders")
        .select("id, order_number, company_id, total_amount")
        .eq("qc_evidence_uploaded", false)
        .eq("status", "in_production")
        .gt("total_amount", 0);

      if (revenueHeldOrders) {
        const totalHeld = revenueHeldOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
        if (totalHeld > 0 && revenueHeldOrders[0]?.company_id) {
          const firstOrder = revenueHeldOrders[0];
          if (!isDuplicate("order", firstOrder.id, "revenue_held_qc")) {
            const row = {
              company_id: firstOrder.company_id,
              agent_id: agentMap.vizzy,
              suggestion_type: "action",
              category: "revenue_held_qc",
              title: `$${totalHeld.toFixed(0)} revenue held — QC evidence missing`,
              description: `${revenueHeldOrders.length} order(s) cannot be invoiced until QC evidence is uploaded.`,
              severity: "warning",
              reason: "QC evidence gates delivery and invoicing.",
              impact: `$${totalHeld.toFixed(2)} blocked`,
              entity_type: "order",
              entity_id: firstOrder.id,
              status: "open",
              actions: [{ label: "View Orders", action: "navigate", path: "/accounting?tab=orders" }],
            };
            pushDual(row, `vizzy:revenue_held:batch`, agentMap.vizzy);
          }
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

      // Also load linked customer names to detect duplicates
      const { data: linkedCustomers } = await supabase
        .from("customers")
        .select("name")
        .not("quickbooks_id", "is", null)
        .not("company_id", "is", null);
      const linkedNameSet = new Set(
        (linkedCustomers || []).map((c: any) => (c.name || "").toLowerCase().trim().replace(/\s+/g, " "))
      );

      if (missingQb) {
        for (const cust of missingQb) {
          if (isDuplicate("customer", cust.id, "missing_qb")) continue;
          const normalizedName = (cust.name || "").toLowerCase().trim().replace(/\s+/g, " ");

          // Check if this is a duplicate of an already-linked customer or a contact-variant
          const isDup = linkedNameSet.has(normalizedName);
          const isVariant = !isDup && Array.from(linkedNameSet).some(
            (ln: string) => normalizedName.startsWith(ln) && normalizedName.length > ln.length
          );

          if (isDup) {
            // Skip duplicates entirely — they already have a linked counterpart
            continue;
          }

          const row = {
            company_id: (cust as any).company_id,
            agent_id: agentMap.penny,
            suggestion_type: isVariant ? "info" : "action",
            category: "missing_qb",
            title: isVariant
              ? `${cust.name} — contact variant (auto-links on next sync)`
              : `${cust.name} — not found in QuickBooks`,
            description: isVariant
              ? "This appears to be a contact-specific entry. It will auto-link on the next sync."
              : "This customer doesn't exist in QuickBooks yet. Create them there to enable invoice sync.",
            severity: "info",
            reason: isVariant
              ? "A matching company already exists in QuickBooks — this variant will be linked automatically."
              : "Without a QuickBooks record, invoices for this customer can't sync. Create the customer in QuickBooks first.",
            entity_type: "customer",
            entity_id: cust.id,
            status: "open",
            actions: [
              { label: "View Customer", action: "navigate", path: `/customers?search=${encodeURIComponent(cust.name)}` },
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

          const customerName = resolveCustomerName(inv);
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
              { label: "View Invoice", action: "navigate", path: `/customer-action/${inv.customer_id || "unknown"}?invoice=${inv.id}` },
            ],
          };
          pushDual(row, `penny:overdue_ar:${inv.id}:${tier}`, agentMap.penny);
        }
      }

      // Paid revision opportunities
      const { data: revisionOpps } = await supabase
        .from("orders")
        .select("id, order_number, company_id, customer_revision_count")
        .eq("billable_revision_required", true)
        .eq("pending_change_order", true);

      if (revisionOpps) {
        for (const order of revisionOpps) {
          if (!order.company_id || isDuplicate("order", order.id, "paid_revision")) continue;
          const row = {
            company_id: order.company_id,
            agent_id: agentMap.penny,
            suggestion_type: "action",
            category: "paid_revision",
            title: `${order.order_number} — billable revision opportunity`,
            description: `${order.customer_revision_count} revisions. Change Order required for billing.`,
            severity: "warning",
            reason: "Customer exceeded free revision allowance.",
            entity_type: "order",
            entity_id: order.id,
            status: "open",
            actions: [{ label: "View Order", action: "navigate", path: `/accounting?tab=orders&search=${encodeURIComponent(order.order_number)}` }],
          };
          pushDual(row, `penny:paid_revision:${order.id}`, agentMap.penny);
        }
      }
      }

      // Penny: Collection queue follow-up overdue
      const { data: overdueFollowups } = await supabase
        .from("penny_collection_queue")
        .select("id, company_id, invoice_id, customer_name, amount, days_overdue, followup_date, followup_count, action_type")
        .eq("status", "pending_approval")
        .not("followup_date", "is", null);

      if (overdueFollowups) {
        const today = now.toISOString().split("T")[0];
        for (const item of overdueFollowups) {
          if (!item.company_id || !item.followup_date || item.followup_date > today) continue;
          const dedupeKey = `penny:followup_overdue:${item.id}`;
          if (isTaskDupe(dedupeKey)) continue;

          const row = {
            company_id: item.company_id,
            agent_id: agentMap.penny,
            suggestion_type: "action",
            category: "followup_overdue",
            title: `Follow-up overdue: ${item.customer_name} — $${item.amount}`,
            description: `Last contact was for Invoice ${item.invoice_id || "unknown"}. Follow-up ${item.followup_count} times with no payment.`,
            severity: item.followup_count >= 3 ? "critical" : "warning",
            reason: `Scheduled follow-up on ${item.followup_date} is past due. ${item.followup_count} previous attempts.`,
            impact: `$${item.amount} at risk`,
            entity_type: "penny_queue",
            entity_id: item.id,
            status: "open",
            actions: [{ label: "View AI Actions", action: "navigate", path: "/accounting?tab=actions" }],
          };
          pushDual(row, dedupeKey, agentMap.penny);
        }

        // Batch-ready summary
        const pendingEmails = overdueFollowups.filter(i => i.action_type === "email_reminder");
        if (pendingEmails.length >= 3 && !isTaskDupe("penny:batch_emails_ready")) {
          const totalAmt = pendingEmails.reduce((s, i) => s + (i.amount || 0), 0);
          const row = {
            company_id: pendingEmails[0].company_id,
            agent_id: agentMap.penny,
            suggestion_type: "action",
            category: "batch_emails_ready",
            title: `${pendingEmails.length} invoices ready for collection email`,
            description: `$${totalAmt.toLocaleString()} in AR — approve batch in AI Actions`,
            severity: "info",
            reason: `${pendingEmails.length} email reminders are queued and ready to send.`,
            impact: `$${totalAmt.toLocaleString()} AR`,
            entity_type: "penny_queue",
            entity_id: "batch",
            status: "open",
            actions: [{ label: "Review in AI Actions", action: "navigate", path: "/accounting?tab=actions" }],
          };
          pushDual(row, "penny:batch_emails_ready", agentMap.penny);
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

    // ========== WEBSITE HEALTH CHECK ==========
    try {
      const healthRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/website-health-check`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        if (healthData.issues && Array.isArray(healthData.issues)) {
          for (const issue of healthData.issues) {
            const agentId = agentMap[issue.assigned_agent];
            if (!agentId) continue;
            const companyId = suggestions[0]?.company_id || "a0000000-0000-0000-0000-000000000001";
            const dedupeKey = `wp:${issue.issue_type}:${issue.entity_id}`;
            if (isDuplicate(issue.entity_type, issue.entity_id, issue.issue_type)) continue;

            const row = {
              company_id: companyId,
              agent_id: agentId,
              suggestion_type: "action",
              category: issue.issue_type,
              title: issue.title,
              description: issue.description,
              severity: issue.severity,
              reason: issue.reason,
              impact: issue.impact,
              entity_type: issue.entity_type,
              entity_id: issue.entity_id,
              status: "open",
              actions: [{ label: "View Website", action: "navigate", path: "/website" }],
            };
            pushDual(row, dedupeKey, agentId);
          }
        }
        console.log(`🌐 Website health: ${healthData.issues_found || 0} issues added to suggestions`);
      }
    } catch (wpErr) {
      console.error("Website health check failed (non-fatal):", wpErr);
    }

    // ========== WEBSITE SPEED AUDIT ==========
    try {
      const speedRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/website-speed-audit`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      if (speedRes.ok) {
        const speedData = await speedRes.json();
        if (speedData.issues && Array.isArray(speedData.issues)) {
          for (const issue of speedData.issues) {
            const agentId = agentMap[issue.assigned_agent];
            if (!agentId) continue;
            const companyId = suggestions[0]?.company_id || "a0000000-0000-0000-0000-000000000001";
            const dedupeKey = `speed:${issue.type}:${issue.title.slice(0, 40)}`;
            if (isDuplicate("wp_speed", issue.type, issue.type)) continue;

            const row = {
              company_id: companyId,
              agent_id: agentId,
              suggestion_type: "action",
              category: issue.type,
              title: issue.title,
              description: issue.description,
              severity: issue.severity,
              reason: `Metric: ${issue.metric ?? "N/A"}, Threshold: ${issue.threshold ?? "N/A"}`,
              impact: "Core Web Vitals failure",
              entity_type: "wp_speed",
              entity_id: issue.type,
              status: "open",
              actions: [{ label: "View Website", action: "navigate", path: "/website" }],
            };
            pushDual(row, dedupeKey, agentId);
          }
        }
        // Add server-side recommendations as info suggestions for Commet
        if (speedData.recommendations && Array.isArray(speedData.recommendations) && agentMap.webbuilder) {
          for (const rec of speedData.recommendations) {
            const dedupeKey = `speed:rec:${rec.action}`;
            if (isDuplicate("wp_speed", rec.action, "speed_recommendation")) continue;
            const companyId = suggestions[0]?.company_id || "a0000000-0000-0000-0000-000000000001";
            const row = {
              company_id: companyId,
              agent_id: agentMap.webbuilder,
              suggestion_type: "info",
              category: "speed_recommendation",
              title: `🚀 ${rec.title}`,
              description: rec.description,
              severity: rec.priority <= 2 ? "warning" : "info",
              reason: `Priority ${rec.priority}. Requires server-side action.`,
              impact: "Improved Core Web Vitals",
              entity_type: "wp_speed",
              entity_id: rec.action,
              status: "open",
              actions: [{ label: "View Website", action: "navigate", path: "/website" }],
            };
            pushDual(row, dedupeKey, agentMap.webbuilder);
          }
        }
        console.log(`🚀 Speed audit: ${speedData.issues_found || 0} issues, ${speedData.recommendations_count || 0} recommendations added`);
      }
    } catch (speedErr) {
      console.error("Speed audit failed (non-fatal):", speedErr);
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
