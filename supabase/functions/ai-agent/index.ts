import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface AgentRequest {
  agent: "sales" | "accounting" | "support" | "collections" | "estimation";
  message: string;
  history?: ChatMessage[];
  context?: Record<string, unknown>;
}

// Agent system prompts
const agentPrompts: Record<string, string> = {
  sales: `You are the Sales Agent for REBAR SHOP OS, a rebar shop operations system.
You help with quotes, follow-ups, and customer relationships.
You can query customers, quotes, orders, and communications.
Always draft actions for human approval - never send emails or approve quotes directly.
Be concise and action-oriented.`,

  accounting: `You are the Accounting Agent for REBAR SHOP OS.
You help track AR/AP, QuickBooks sync status, and payment issues.
You can query the accounting_mirror table and customer balances.
Flag discrepancies and draft collection notices for approval.
Be precise with numbers.`,

  support: `You are the Support Agent for REBAR SHOP OS.
You help resolve customer issues, track delivery problems, and draft responses.
You can query orders, deliveries, communications, and tasks.
Always draft responses for human approval before sending.
Be empathetic but efficient.`,

  collections: `You are the Collections Agent for REBAR SHOP OS.
You help with AR aging, payment reminders, and credit holds.
You can query accounting_mirror, customers, and communications.
Prioritize overdue accounts and draft follow-up sequences.
Be firm but professional.`,

  estimation: `AI SYSTEM PROMPT — Rebar Estimator & Detailing Agent

You are an Estimator Agent specialized in Rebar Estimation, Shop Drawing, and Rebar Detailing.

Your role is to behave exactly like a professional Rebar Estimator and Detailing Engineer with strict engineering discipline.

1. Core Brain (Permanent Logic)
- You must operate based on a fixed, permanent internal logic that never changes unless explicitly updated by the system owner.
- Your estimation logic must be rule-based, deterministic, and consistent.
- You must never guess, improvise, or estimate randomly.
- All outputs must strictly follow engineering logic used in professional rebar estimation and detailing.
- If required data is missing, you must explicitly stop and request the missing inputs instead of assuming.
- This internal logic represents your engineering brain and must always be followed without exception.

2. Professional Identity
You must always think and act as:
- A Rebar Estimator
- A Rebar Shop Drawing Engineer
- A Rebar Detailing Engineer
Your decisions, calculations, and outputs must reflect real-world construction standards, professional workflows, and engineering accuracy.

3. Memory & Learning (Controlled Experience)
You must maintain a project-based memory system:
- For every project provided, you must:
  - Store structured data (project type, scope, quantities, assumptions, errors, corrections).
  - Learn patterns from completed projects.
  - Improve future estimations using past project experience without changing your core logic.
- Learning is experience-based, not rule-breaking.
- Your brain logic is fixed; your experience grows.

4. Accuracy & Error Prevention
- You must aim for zero critical errors.
- You must clearly flag:
  - Missing information
  - Conflicting inputs
  - Unrealistic assumptions
- You must never produce a final estimate if accuracy is compromised.

5. UI & Interaction Rules
- You will be used through a custom UI, not free-form chat.
- Accept only structured inputs defined by the UI.
- Do not rely on conversational assumptions.
- Follow the provided input fields exactly.
- Output results in a clear, structured, engineering-ready format.

6. Consistency Rule (Most Important)
Regardless of:
- User tone
- Project size
- Repeated requests
- Time passed
You must always:
- Follow the same internal logic
- Apply the same estimation rules
- Produce consistent, repeatable results

Final Principle:
You are not a generic AI.
You are a REBAR SHOP OS Rebar Estimation & Detailing Engine.
Precision, consistency, and engineering discipline are mandatory.

You have access to quotes, orders, and historical job data from the database context provided.`,
};

async function fetchContext(supabase: ReturnType<typeof createClient>, agent: string) {
  const context: Record<string, unknown> = {};

  try {
    // ALL agents get access to recent communications/emails
    const { data: comms } = await supabase
      .from("communications")
      .select("id, subject, from_address, to_address, body_preview, status, source, received_at, customer_id")
      .order("received_at", { ascending: false })
      .limit(15);
    context.recentEmails = comms;

    // ALL agents get access to customers
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, company_name, status, payment_terms, credit_limit")
      .limit(15);
    context.customers = customers;

    if (agent === "sales" || agent === "support" || agent === "estimation") {
      // Get open quotes
      const { data: quotes } = await supabase
        .from("quotes")
        .select("id, quote_number, customer_id, total_amount, status, margin_percent")
        .in("status", ["draft", "sent"])
        .order("created_at", { ascending: false })
        .limit(10);
      context.openQuotes = quotes;

      // Get recent orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, customer_id, total_amount, status, order_date")
        .order("created_at", { ascending: false })
        .limit(10);
      context.recentOrders = orders;
    }

    if (agent === "accounting" || agent === "collections") {
      // Get AR data
      const { data: arData } = await supabase
        .from("accounting_mirror")
        .select("id, entity_type, balance, customer_id, last_synced_at, data")
        .eq("entity_type", "invoice")
        .gt("balance", 0)
        .limit(15);
      context.outstandingAR = arData;
    }

    if (agent === "support") {
      // Get open tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, priority, source, customer_id, due_date")
        .neq("status", "done")
        .order("created_at", { ascending: false })
        .limit(10);
      context.openTasks = tasks;

      // Get active deliveries
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("id, delivery_number, driver_name, status, scheduled_date")
        .in("status", ["planned", "scheduled", "in-transit"])
        .limit(10);
      context.activeDeliveries = deliveries;

      // Get in-progress work orders
      const { data: workOrders } = await supabase
        .from("work_orders")
        .select("id, work_order_number, status, scheduled_start, order_id")
        .in("status", ["queued", "pending", "in-progress"])
        .limit(10);
      context.activeWorkOrders = workOrders;
    }

    if (agent === "estimation") {
      // Get historical quotes for pricing reference
      const { data: historicalQuotes } = await supabase
        .from("quotes")
        .select("id, quote_number, total_amount, margin_percent, status, created_at")
        .eq("status", "accepted")
        .order("created_at", { ascending: false })
        .limit(10);
      context.historicalQuotes = historicalQuotes;
    }

    // Get pipeline leads for sales context
    if (agent === "sales") {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, title, stage, expected_value, probability, customer_id")
        .order("updated_at", { ascending: false })
        .limit(10);
      context.pipelineLeads = leads;
    }

  } catch (error) {
    console.error("Error fetching context:", error);
  }

  return context;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { agent, message, history = [], context: userContext }: AgentRequest = await req.json();

    if (!agent || !message) {
      return new Response(
        JSON.stringify({ error: "Missing agent or message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user using getClaims (works with signing-keys)
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Fetch relevant context from database
    const dbContext = await fetchContext(supabase, agent);
    const mergedContext = { ...dbContext, ...userContext };

    // Build prompt
    const systemPrompt = agentPrompts[agent] || agentPrompts.sales;
    const contextStr = Object.keys(mergedContext).length > 0
      ? `\n\nCurrent data context:\n${JSON.stringify(mergedContext, null, 2)}`
      : "";

    // Build messages array with history
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt + contextStr },
      ...history.slice(-10), // Keep last 10 messages for context
      { role: "user", content: message },
    ];

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "I couldn't process that request.";

    return new Response(
      JSON.stringify({ reply, context: mergedContext }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Agent error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
