import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AgentRequest {
  agent: "sales" | "accounting" | "support" | "collections" | "estimation";
  message: string;
  context?: Record<string, unknown>;
}

// Agent system prompts
const agentPrompts: Record<string, string> = {
  sales: `You are the Sales Agent for CUSUM, a rebar shop operations system.
You help with quotes, follow-ups, and customer relationships.
You can query customers, quotes, orders, and communications.
Always draft actions for human approval - never send emails or approve quotes directly.
Be concise and action-oriented.`,

  accounting: `You are the Accounting Agent for CUSUM.
You help track AR/AP, QuickBooks sync status, and payment issues.
You can query the accounting_mirror table and customer balances.
Flag discrepancies and draft collection notices for approval.
Be precise with numbers.`,

  support: `You are the Support Agent for CUSUM.
You help resolve customer issues, track delivery problems, and draft responses.
You can query orders, deliveries, communications, and tasks.
Always draft responses for human approval before sending.
Be empathetic but efficient.`,

  collections: `You are the Collections Agent for CUSUM.
You help with AR aging, payment reminders, and credit holds.
You can query accounting_mirror, customers, and communications.
Prioritize overdue accounts and draft follow-up sequences.
Be firm but professional.`,

  estimation: `You are the Estimation Agent for CUSUM.
You help with job costing, material pricing, and margin calculations.
You can query quotes, orders, and historical job data.
Flag low-margin quotes and suggest pricing adjustments.
Be thorough with cost breakdowns.`,
};

async function fetchContext(supabase: ReturnType<typeof createClient>, agent: string) {
  const context: Record<string, unknown> = {};

  try {
    if (agent === "sales" || agent === "support") {
      // Get recent customers
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, company_name, status")
        .limit(10);
      context.customers = customers;

      // Get open quotes
      const { data: quotes } = await supabase
        .from("quotes")
        .select("id, quote_number, customer_id, total_amount, status, margin_percent")
        .eq("status", "draft")
        .limit(5);
      context.openQuotes = quotes;

      // Get recent orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, customer_id, total_amount, status")
        .order("created_at", { ascending: false })
        .limit(5);
      context.recentOrders = orders;
    }

    if (agent === "accounting" || agent === "collections") {
      // Get AR data
      const { data: arData } = await supabase
        .from("accounting_mirror")
        .select("id, entity_type, balance, customer_id, last_synced_at")
        .eq("entity_type", "invoice")
        .gt("balance", 0)
        .limit(10);
      context.outstandingAR = arData;

      // Get customer info
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, company_name, payment_terms, credit_limit")
        .limit(10);
      context.customers = customers;
    }

    if (agent === "support") {
      // Get open tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status, priority, source")
        .eq("status", "open")
        .limit(10);
      context.openTasks = tasks;

      // Get recent communications
      const { data: comms } = await supabase
        .from("communications")
        .select("id, subject, from_address, status, received_at")
        .eq("status", "unread")
        .order("received_at", { ascending: false })
        .limit(5);
      context.unreadEmails = comms;
    }

    if (agent === "estimation") {
      // Get recent quotes for reference
      const { data: quotes } = await supabase
        .from("quotes")
        .select("id, quote_number, total_amount, margin_percent, status")
        .order("created_at", { ascending: false })
        .limit(10);
      context.recentQuotes = quotes;
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

    const { agent, message, context: userContext }: AgentRequest = await req.json();

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

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch relevant context from database
    const dbContext = await fetchContext(supabase, agent);
    const mergedContext = { ...dbContext, ...userContext };

    // Build prompt
    const systemPrompt = agentPrompts[agent] || agentPrompts.sales;
    const contextStr = Object.keys(mergedContext).length > 0
      ? `\n\nCurrent data context:\n${JSON.stringify(mergedContext, null, 2)}`
      : "";

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt + contextStr },
          { role: "user", content: message },
        ],
        max_tokens: 500,
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
