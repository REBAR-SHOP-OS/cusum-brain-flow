
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { performOCR, performOCROnBase64, analyzeDocumentWithGemini, convertPdfToImages, detectZones, extractRebarData, performMultiPassAnalysis } from "./agentDocumentUtils.ts";
import type { ValidationRule } from "./agentTypes.ts";
import { buildEventPromptBlock } from "./eventCalendar.ts";

export async function fetchContext(
  supabase: ReturnType<typeof createClient>, 
  agent: string, 
  userId?: string, 
  userEmail?: string, 
  userRolesList?: string[], 
  svcClient?: ReturnType<typeof createClient>, 
  companyId?: string
): Promise<Record<string, unknown>> {

  const context: Record<string, unknown> = {};
  const svc = svcClient || supabase; // Fallback

  // Import cache helper
  const { cachedQuery } = await import("./cache.ts");
  const cid = companyId || "default";

  try {
    // Skip heavy context for social/Pixel agent — it only needs Brain knowledge + employees
    if (agent === "social") {
      // Jump straight to employees + brain block (handled below)
    } else {
      // 1. Basic Communications (Last 15 emails) — realtime, no cache
      const { data: comms } = await supabase
        .from("communications")
        .select("id, subject, from_address, to_address, body_preview, status, source, received_at, customer_id")
        .order("received_at", { ascending: false })
        .limit(15);
      context.recentEmails = comms;

      // 2. Customers (Top 15) — cached 5 min
      context.customers = await cachedQuery(`agent:${cid}:customers`, 5 * 60_000, async () => {
        const { data } = await supabase
          .from("customers")
          .select("id, name, company_name, status, payment_terms, credit_limit")
          .limit(15);
        return data;
      });
    }

    // 3. Agent-Specific Data Loading
    
    // --- Sales / Support / Estimation Common Data ---
    if (agent === "sales" || agent === "support" || agent === "estimation") {
      const { data: quotes } = await supabase
        .from("quotes")
        .select("id, quote_number, customer_id, total_amount, status, margin_percent")
        .in("status", ["draft", "sent"])
        .order("created_at", { ascending: false })
        .limit(10);
      context.openQuotes = quotes;

      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, customer_id, total_amount, status, order_date")
        .order("created_at", { ascending: false })
        .limit(10);
      context.recentOrders = orders;
    }

    // --- Commander (Sales Manager) ---
    if (agent === "commander") {
      try {
        const { data: allLeads } = await supabase
          .from("leads")
          .select("id, name, company, status, stage, expected_value, assigned_to, source, created_at, updated_at, notes")
          .not("status", "eq", "lost")
          .order("expected_value", { ascending: false })
          .limit(200);
        context.allActiveLeads = allLeads;

        // Sales team profiles
        const { data: salesProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, title, department")
          .eq("department", "Sales")
          .eq("is_active", true);
        context.salesTeamProfiles = salesProfiles;
      } catch (e) { console.error("Commander context error", e); }
    }

    // --- Accounting (Penny) ---
    if (agent === "accounting" || agent === "collections") {
      const { data: arData } = await supabase
        .from("accounting_mirror")
        .select("id, entity_type, balance, customer_id, last_synced_at, data")
        .eq("entity_type", "Invoice")
        .gt("balance", 0)
        .limit(15);
      context.outstandingAR = arData;

      // Unread accounting emails
      try {
        const { data: accountingEmails } = await supabase
          .from("communications")
          .select("id, subject, from_address, to_address, status, received_at")
          .or("to_address.ilike.%accounting@rebar.shop%,from_address.ilike.%accounting@rebar.shop%")
          .order("received_at", { ascending: false })
          .limit(20);
        context.accountingEmails = accountingEmails;
        context.unreadAccountingEmails = (accountingEmails || []).filter((e: any) => e.status === "unread").length;
      } catch (_) {}
    }

    // --- Shop Floor (Forge) ---
    if (agent === "shopfloor") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      // Machines
      const { data: machines } = await supabase
        .from("machines")
        .select("id, name, status, type, current_operator_profile_id, current_run_id")
        .order("name");
      context.machineStatus = machines;

      // Active Work Orders (expanded — with created_at for date awareness)
      const { data: workOrders } = await supabase
        .from("work_orders")
        .select("id, work_order_number, status, scheduled_start, order_id, priority, notes, created_at")
        .in("status", ["queued", "pending", "in-progress"])
        .order("scheduled_start", { ascending: true })
        .limit(50);

      const todayDateStr = new Date().toISOString().split("T")[0];
      context.activeWorkOrders = (workOrders || []).map((wo: any) => ({
        ...wo,
        is_created_today: wo.created_at ? wo.created_at.startsWith(todayDateStr) : false,
        is_scheduled_today: wo.scheduled_start ? wo.scheduled_start.startsWith(todayDateStr) : false,
      }));

      // Today's Machine Runs (with operator names via profile map)
      const { data: machineRuns } = await supabase
        .from("machine_runs")
        .select("id, machine_id, process, status, started_at, ended_at, output_qty, scrap_qty, operator_profile_id, notes")
        .gte("started_at", todayISO)
        .order("started_at", { ascending: false })
        .limit(100);

      // Build operator name map from available employees
      const profileIdMap = new Map<string, string>();
      if (context.availableEmployees) {
        for (const emp of context.availableEmployees as any[]) {
          profileIdMap.set(emp.id, emp.name);
        }
      } else {
        const { data: profs } = await svc.from("profiles").select("id, full_name").eq("is_active", true);
        for (const p of profs || []) profileIdMap.set(p.id, p.full_name);
      }

      // Map machine names
      const machineIdMap = new Map<string, string>();
      for (const m of (machines || []) as any[]) machineIdMap.set(m.id, m.name);

      context.machineRunsToday = (machineRuns || []).map((r: any) => ({
        id: r.id,
        machine_name: machineIdMap.get(r.machine_id) || r.machine_id,
        process: r.process,
        status: r.status,
        started_at: r.started_at,
        ended_at: r.ended_at,
        output_qty: r.output_qty,
        scrap_qty: r.scrap_qty,
        operator_name: profileIdMap.get(r.operator_profile_id) || null,
        notes: r.notes,
      }));

      // Production summary
      const completedRuns = (machineRuns || []).filter((r: any) => r.status === "completed");
      context.productionSummary = {
        totalRunsToday: (machineRuns || []).length,
        completedRuns: completedRuns.length,
        totalPiecesProduced: completedRuns.reduce((s: number, r: any) => s + (r.output_qty || 0), 0),
        totalScrap: completedRuns.reduce((s: number, r: any) => s + (r.scrap_qty || 0), 0),
      };

      // Active Cut Plans
      const { data: cutPlans } = await supabase
        .from("cut_plans")
        .select("id, name, status, machine_id, created_at")
        .in("status", ["active", "in_progress", "queued"])
        .limit(20);
      context.activeCutPlans = (cutPlans || []).map((cp: any) => ({
        ...cp,
        machine_name: machineIdMap.get(cp.machine_id) || cp.machine_id,
      }));

      // Cut Plan Items phase counts
      const { data: cutPlanItems } = await supabase
        .from("cut_plan_items")
        .select("id, phase, cut_plan_id")
        .limit(500);
      const phaseCounts: Record<string, number> = {};
      for (const item of cutPlanItems || []) {
        phaseCounts[item.phase] = (phaseCounts[item.phase] || 0) + 1;
      }
      context.cutPlanItemPhaseCounts = phaseCounts;

      // Today's Timeclock Entries
      const { data: timeclockEntries } = await supabase
        .from("time_clock_entries")
        .select("id, profile_id, clock_in, clock_out, break_minutes, notes")
        .gte("clock_in", todayISO)
        .order("clock_in", { ascending: false })
        .limit(50);
      context.timeclockToday = (timeclockEntries || []).map((t: any) => ({
        ...t,
        employee_name: profileIdMap.get(t.profile_id) || t.profile_id,
      }));
      // Deliveries (cross-department visibility for Forge)
      const { data: shopDeliveries } = await supabase
        .from("deliveries")
        .select("id, delivery_number, status, scheduled_date, driver_name, notes")
        .in("status", ["planned", "scheduled", "loading", "in_transit"])
        .order("scheduled_date", { ascending: true })
        .limit(15);
      context.activeDeliveries = shopDeliveries;
    }

    // --- Delivery (Atlas) ---
    if (agent === "delivery") {
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("id, delivery_number, driver_name, vehicle, status, scheduled_date, notes")
        .order("scheduled_date", { ascending: true })
        .limit(30);
      context.deliveries = deliveries;
      
      const { data: stops } = await supabase
        .from("delivery_stops")
        .select("id, delivery_id, stop_sequence, address, customer_id, status, arrival_time, departure_time")
        .order("stop_sequence", { ascending: true })
        .limit(60);
      context.deliveryStops = stops;
    }

    // --- Estimation (Gauge) ---
    if (agent === "estimation") {
      // Rebar Standards — cached 10 min (rarely changes)
      context.rebarStandards = await cachedQuery(`agent:${cid}:rebarStandards`, 10 * 60_000, async () => {
        const { data } = await supabase.from("rebar_standards").select("*");
        return data;
      });
      
      // Validation Rules — cached 10 min
      context.validationRules = await cachedQuery(`agent:${cid}:validationRules`, 10 * 60_000, async () => {
        const { data } = await supabase.from("validation_rules").select("*");
        return data;
      });
    }

    // --- Available Employees (Shared, cached 5 min) ---
    const employees = await cachedQuery(`agent:${cid}:employees`, 5 * 60_000, async () => {
      const { data } = await svc
        .from("profiles")
        .select("id, full_name, title, department")
        .eq("is_active", true)
        .order("full_name");
      return data;
    });
    context.availableEmployees = (employees || []).map((e: any) => ({
      id: e.id, name: e.full_name, title: e.title, department: e.department,
    }));

    // --- Role Access Block Construction ---
    const isRestricted = userRolesList && !userRolesList.some(r => ["admin", "accounting", "office", "sales"].includes(r));
    const RESTRICTED_RULES = `## Role-Based Information Access (MANDATORY)
Current user roles: ${userRolesList?.join(", ") || "none"}
ACCESS LEVELS:
- ADMIN: Full access
- WORKSHOP: Machine status, production queue, their own jobs. CANNOT SEE: Financials, HR, Strategy.
ENFORCEMENT RULES:
1. If a workshop user asks about finances, politely redirect.
2. Never reveal dollar amounts to workshop users.`;

    context.roleAccessBlock = `\n\n## Current User Access Level\nRoles: ${userRolesList?.join(", ")}\n${isRestricted ? RESTRICTED_RULES : "Full access granted."}`;

    // --- Brain Knowledge Block Construction ---
    try {
      // Brain knowledge — cached 5 min (changes infrequently)
      const brainDocs = await cachedQuery(`agent:${cid}:brainDocs`, 5 * 60_000, async () => {
        const { data } = await svc
          .from("knowledge")
          .select("title, content, category, metadata, source_url")
          .in("category", ["company-playbook", "agent-strategy"])
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });
        return data;
      });
      
      let brainBlock = "";
      if (brainDocs) {
        // Always inject company playbook
        const shared = brainDocs.filter((d: any) => d.category === "company-playbook");
        if (shared.length > 0) brainBlock += `\n\n## 🧠 BRAIN: Company Playbook\n${shared[0].content}`;

        // Map agent code → strategy title prefix
        const agentStrategyMap: Record<string, string> = {
          accounting: "Penny",
          sales: "Blitz",
          commander: "Vizzy",
          estimation: "Gauge",
          shopfloor: "Forge",
          delivery: "Atlas",
          legal: "Tally",
          empire: "Vizzy",
          data: "Prism",
          support: "Haven",
          collections: "Penny",
          email: "Relay",
          social: "Pixel",
          talent: "Scouty",
          seo: "Seomi",
          bizdev: "Buddy",
          copywriting: "Penn",
          eisenhower: "Vizzy",
          assistant: "Vizzy",
          growth: "Buddy",
          webbuilder: "Commet",
        };

        const agentPersonaName = agentStrategyMap[agent];
        if (agentPersonaName) {
          const agentStrategy = brainDocs.find((d: any) =>
            d.category === "agent-strategy" && d.title?.toLowerCase().includes(agentPersonaName.toLowerCase())
          );
          if (agentStrategy) {
            brainBlock += `\n\n## 🎯 AGENT STRATEGY: ${agentStrategy.title}\n${agentStrategy.content}`;
          }
        }
      }

      // Pixel-specific: fetch knowledge items tagged with metadata.agent = "social"
      if (agent === "social") {
        // Inject upcoming event calendar as PASSIVE reference (opt-in only)
        const eventBlock = buildEventPromptBlock(new Date(), 5);
        if (eventBlock) {
          brainBlock += `\n${eventBlock}`;
        }

        try {
          const { data: pixelItems } = await svc
            .from("knowledge")
            .select("title, content, category, metadata, source_url")
            .eq("company_id", companyId)
            .order("created_at", { ascending: false })
            .limit(30);

          if (pixelItems) {
            const socialItems = pixelItems.filter((d: any) => d.metadata?.agent === "social");
            
            // Separate instructions from resources
            const instrItem = socialItems.find((d: any) => d.metadata?.type === "instructions");
            const resourceItems = socialItems.filter((d: any) => d.metadata?.type !== "instructions");

            if (instrItem?.content) {
              brainBlock += `\n\n## 📋 USER CUSTOM INSTRUCTIONS (ALWAYS FOLLOW THESE):\n${instrItem.content}`;
            }

            if (resourceItems.length > 0) {
              brainBlock += `\n\n## 📁 PIXEL BRAIN RESOURCES (${resourceItems.length} items):`;
              for (const item of resourceItems) {
                brainBlock += `\n- **${item.title}** [${item.category}]`;
                if (item.content) brainBlock += `: ${item.content.slice(0, 300)}`;
                if (item.source_url) brainBlock += ` (URL: ${item.source_url})`;
              }
            }
          }
        } catch (_pixelErr) {
          console.warn("[agentContext] Failed to fetch Pixel brain items:", _pixelErr);
        }
      }

      context.brainKnowledgeBlock = brainBlock;
    } catch (_) {}

  } catch (err) {
    console.error(`fetchContext error for ${agent}:`, err);
    context.error = `Context fetch partial failure: ${err instanceof Error ? err.message : String(err)}`;
  }

  return context;
}

/**
 * RAG step: search document_embeddings for relevant historical context.
 * Returns top-K results as a formatted string block to inject into the system prompt.
 */
export async function fetchRAGContext(
  supabaseUrl: string,
  agent: string,
  query: string,
  companyId: string,
): Promise<string> {
  if (!query || query.length < 5) return "";

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/search-embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        query,
        domain: agent,
        companyId,
        matchCount: 5,
        threshold: 0.55,
      }),
    });

    if (!response.ok) return "";

    const { results } = await response.json();
    if (!results || results.length === 0) return "";

    const formatted = results.map((r: any, i: number) =>
      `[${i + 1}] (${r.entity_type || "doc"}) ${r.content_text?.substring(0, 300)}`
    ).join("\n");

    return `\n\n## 🔍 Relevant Historical Context (RAG)\n${formatted}`;
  } catch (e) {
    console.error("RAG fetch error:", e);
    return "";
  }
}

// Full QuickBooks live context — queries real QB tables for Penny (accounting agent)
export async function fetchQuickBooksLiveContext(svcClient: any, companyId: string): Promise<Record<string, unknown>> {
  const qb: Record<string, unknown> = {};

  try {
    // 1. Open AR invoices (balance > 0) — top 50 by balance desc
    const { data: openInvoices } = await svcClient
      .from("qb_transactions")
      .select("qb_id, doc_number, txn_date, total_amt, balance, customer_qb_id, raw_json")
      .eq("company_id", companyId)
      .eq("entity_type", "Invoice")
      .eq("is_deleted", false)
      .gt("balance", 0)
      .order("balance", { ascending: false })
      .limit(50);

    qb.qbInvoices = (openInvoices || []).map((inv: any) => ({
      id: inv.qb_id,
      docNumber: inv.doc_number,
      date: inv.txn_date,
      total: inv.total_amt,
      balance: inv.balance,
      customerName: inv.raw_json?.CustomerRef?.name || inv.customer_qb_id,
      dueDate: inv.raw_json?.DueDate || null,
    }));

    // 2. Total AR summary
    const { data: arSummary } = await svcClient
      .from("qb_transactions")
      .select("balance, entity_type")
      .eq("company_id", companyId)
      .eq("entity_type", "Invoice")
      .eq("is_deleted", false)
      .gt("balance", 0);

    const totalAR = (arSummary || []).reduce((sum: number, r: any) => sum + (r.balance || 0), 0);
    const openInvoiceCount = (arSummary || []).length;

    // 3. Recent Bills (AP) — last 30
    const { data: bills } = await svcClient
      .from("qb_transactions")
      .select("qb_id, doc_number, txn_date, total_amt, balance, raw_json")
      .eq("company_id", companyId)
      .eq("entity_type", "Bill")
      .eq("is_deleted", false)
      .order("txn_date", { ascending: false })
      .limit(30);

    qb.qbBills = (bills || []).map((b: any) => ({
      id: b.qb_id,
      docNumber: b.doc_number,
      date: b.txn_date,
      total: b.total_amt,
      balance: b.balance,
      vendorName: b.raw_json?.VendorRef?.name || "Unknown Vendor",
      dueDate: b.raw_json?.DueDate || null,
    }));

    const totalAP = (bills || []).reduce((sum: number, b: any) => sum + (b.balance || 0), 0);

    // 4. Recent Payments — last 20
    const { data: payments } = await svcClient
      .from("qb_transactions")
      .select("qb_id, doc_number, txn_date, total_amt, customer_qb_id, raw_json")
      .eq("company_id", companyId)
      .eq("entity_type", "Payment")
      .eq("is_deleted", false)
      .order("txn_date", { ascending: false })
      .limit(20);

    qb.qbRecentPayments = (payments || []).map((p: any) => ({
      id: p.qb_id,
      date: p.txn_date,
      amount: p.total_amt,
      customerName: p.raw_json?.CustomerRef?.name || p.customer_qb_id,
    }));

    // 5. QB Customers (top 30 by open balance)
    const { data: customers } = await svcClient
      .from("qb_customers")
      .select("qb_id, display_name, balance, email, phone, company_id")
      .eq("company_id", companyId)
      .gt("balance", 0)
      .order("balance", { ascending: false })
      .limit(30);

    qb.qbCustomers = (customers || []).map((c: any) => ({
      id: c.qb_id,
      name: c.display_name,
      balance: c.balance,
      email: c.email,
      phone: c.phone,
    }));

    // 6. Bank Activity (current balances)
    const { data: bankActivity } = await svcClient
      .from("qb_bank_activity")
      .select("account_name, account_type, balance, currency_ref, last_updated_time")
      .eq("company_id", companyId)
      .order("balance", { ascending: false })
      .limit(10);

    qb.qbBankActivity = bankActivity || [];

    // 7. Chart of Accounts (key accounts)
    const { data: accounts } = await svcClient
      .from("qb_accounts")
      .select("qb_id, name, account_type, account_sub_type, current_balance, currency_ref")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("account_type")
      .limit(50);

    qb.qbAccounts = (accounts || []).map((a: any) => ({
      id: a.qb_id,
      name: a.name,
      type: a.account_type,
      subType: a.account_sub_type,
      balance: a.current_balance,
    }));

    // 8. Vendors (for AP context)
    const { data: vendors } = await svcClient
      .from("qb_vendors")
      .select("qb_id, display_name, balance, email, vendor_1099")
      .eq("company_id", companyId)
      .order("balance", { ascending: false })
      .limit(20);

    qb.qbVendors = (vendors || []).map((v: any) => ({
      id: v.qb_id,
      name: v.display_name,
      balance: v.balance,
      email: v.email,
    }));

    // 9. Summary block for quick reference
    const bankTotal = (bankActivity || []).reduce((sum: number, b: any) => sum + (b.balance || 0), 0);
    qb.qbSummary = {
      totalAR: Math.round(totalAR * 100) / 100,
      totalAP: Math.round(totalAP * 100) / 100,
      openInvoiceCount,
      openBillCount: (bills || []).filter((b: any) => (b.balance || 0) > 0).length,
      recentPaymentCount: payments?.length || 0,
      bankBalance: Math.round(bankTotal * 100) / 100,
    };

    console.log(`[QB Context] AR=$${qb.qbSummary && (qb.qbSummary as any).totalAR} (${openInvoiceCount} invoices), AP=$${qb.qbSummary && (qb.qbSummary as any).totalAP}`);

  } catch (err) {
    console.error("[QB Context] Error fetching QB live context:", err);
    qb.qbContextError = err instanceof Error ? err.message : String(err);
  }

  return qb;
}

export async function fetchEstimationLearnings(supabase: any) {
  const { data } = await supabase.from("estimation_learnings").select("*").limit(5);
  return data || [];
}

export async function fetchRebarStandards(supabase: any) {
  const { data: standards } = await supabase.from("rebar_standards").select("*");
  const { data: rules } = await supabase.from("validation_rules").select("*");
  return { rebarStandards: standards || [], wwmStandards: [], validationRules: rules || [] };
}
