import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "sattar@rebar.shop";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(token);

    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Access denied. Super admin only." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 15 requests per 60 seconds for admin chat
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: user.id,
      _function_name: "admin-chat",
      _max_requests: 15,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    // Gather live system context for AI
    const [
      { count: activeOrders },
      { data: machines },
      { data: recentEvents },
      { data: pendingSuggestions },
      { count: totalCustomers },
      { data: stockSummary },
    ] = await Promise.all([
      supabase.from("work_orders").select("*", { count: "exact", head: true }).in("status", ["pending", "in_progress"]),
      supabase.from("machines").select("id, name, status, type, current_operator_id").limit(20),
      supabase.from("events").select("event_type, entity_type, description, created_at").order("created_at", { ascending: false }).limit(10),
      supabase.from("suggestions").select("title, suggestion_type, priority, status").eq("status", "pending").order("priority", { ascending: false }).limit(5),
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("inventory_lots").select("bar_code, qty_on_hand, location").gt("qty_on_hand", 0).limit(15),
    ]);

    const systemContext = `
## LIVE SYSTEM STATE (queried just now)
- Active work orders: ${activeOrders ?? 0}
- Total customers: ${totalCustomers ?? 0}
- Machines: ${JSON.stringify(machines || [])}
- Recent events: ${JSON.stringify(recentEvents || [])}
- Pending suggestions: ${JSON.stringify(pendingSuggestions || [])}
- Stock summary: ${JSON.stringify(stockSummary || [])}
`;

    const systemPrompt = `You are the REBAR SHOP OS Admin Console — the super-admin's direct line into the system.
You have FULL access to live system data. You can diagnose issues, explain what's happening, suggest fixes, and provide actionable commands.

${systemContext}

## YOUR CAPABILITIES
- Diagnose production bottlenecks, idle machines, stock shortages
- Analyze recent events and surface anomalies
- Explain why something might be broken (orders stuck, machines idle, low stock)
- Suggest SQL queries or data fixes the admin can run
- Provide actionable next steps, never vague advice

## RULES
- Be direct and concise — this is for a power user, not a novice
- Use markdown formatting: headers, bullet lists, code blocks for SQL
- If you see issues in the live data, proactively mention them
- When suggesting fixes, be specific (table names, column values, exact steps)
- If you don't have enough data to answer, say what additional info you'd need`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("admin-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
