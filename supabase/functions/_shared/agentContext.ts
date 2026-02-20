
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { performOCR, performOCROnBase64, analyzeDocumentWithGemini, convertPdfToImages, detectZones, extractRebarData, performMultiPassAnalysis } from "./agentDocumentUtils.ts";
import type { ValidationRule } from "./agentTypes.ts";

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

  try {
    // 1. Basic Communications (Last 15 emails)
    const { data: comms } = await supabase
      .from("communications")
      .select("id, subject, from_address, to_address, body_preview, status, source, received_at, customer_id")
      .order("received_at", { ascending: false })
      .limit(15);
    context.recentEmails = comms;

    // 2. Customers (Top 15)
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, company_name, status, payment_terms, credit_limit")
      .limit(15);
    context.customers = customers;

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
      // Machines
      const { data: machines } = await supabase
        .from("machines")
        .select("id, name, status, type, current_operator_id, active_run_id")
        .order("name");
      context.machineStatus = machines;
      
      // Active Work Orders
      const { data: workOrders } = await supabase
        .from("work_orders")
        .select("id, work_order_number, status, scheduled_start, order_id")
        .in("status", ["queued", "pending", "in-progress"])
        .limit(15);
      context.activeWorkOrders = workOrders;
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
      // Rebar Standards
      const { data: standards } = await supabase.from("rebar_standards").select("*");
      context.rebarStandards = standards;
      
      // Validation Rules
      const { data: rules } = await supabase.from("validation_rules").select("*");
      context.validationRules = rules;
    }

    // --- Available Employees (Shared for all agents) ---
    const { data: employees } = await svc
      .from("profiles")
      .select("id, full_name, title, department")
      .eq("is_active", true)
      .order("full_name");
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
      const { data: brainDocs } = await svc
        .from("knowledge")
        .select("title, content, category")
        .in("category", ["company-playbook", "agent-strategy"])
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      
      let brainBlock = "";
      if (brainDocs) {
        const shared = brainDocs.filter((d: any) => d.category === "company-playbook");
        if (shared.length > 0) brainBlock += `\n\n## 🧠 BRAIN: Company Playbook\n${shared[0].content}`;
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

// Placeholder for full QuickBooks fetch logic if needed separate
export async function fetchQuickBooksLiveContext(svcClient: any, context: any) {
  // Logic from original file to fetch live QB data
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
