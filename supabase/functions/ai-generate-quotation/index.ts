import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { estimation_project_id, lead_id, customer_name_override } = await req.json();

    if (!estimation_project_id) {
      return new Response(JSON.stringify({ error: "estimation_project_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch estimation project
    const { data: project, error: projErr } = await serviceClient
      .from("estimation_projects")
      .select("*")
      .eq("id", estimation_project_id)
      .single();

    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Estimation project not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch estimation items (BOM)
    const { data: items } = await serviceClient
      .from("estimation_items")
      .select("*")
      .eq("project_id", estimation_project_id)
      .order("element_ref");

    const bomItems = items || [];

    // Fetch lead info if available
    let leadInfo: any = null;
    const effectiveLeadId = lead_id || project.lead_id;
    if (effectiveLeadId) {
      const { data: lead } = await serviceClient
        .from("leads")
        .select("*, customers(name, company_name)")
        .eq("id", effectiveLeadId)
        .single();
      leadInfo = lead;
    }

    // Fetch customer name
    let customerName = customer_name_override || "Valued Customer";
    if (!customer_name_override && project.customer_id) {
      const { data: cust } = await serviceClient
        .from("customers")
        .select("name, company_name")
        .eq("id", project.customer_id)
        .single();
      if (cust) customerName = cust.company_name || cust.name;
    }
    if (!customer_name_override && leadInfo?.customers) {
      customerName = leadInfo.customers.company_name || leadInfo.customers.name || customerName;
    }

    // Build BOM summary for AI
    const bomSummary = bomItems.map(i => ({
      element: i.element_ref || i.element_type,
      mark: i.mark,
      bar_size: i.bar_size,
      qty: i.quantity,
      weight_kg: Number(i.weight_kg || 0),
      unit_cost: Number(i.unit_cost || 0),
      line_cost: Number(i.line_cost || 0),
    }));

    const totalWeight = bomItems.reduce((s, i) => s + Number(i.weight_kg || 0), 0);
    const totalCost = bomItems.reduce((s, i) => s + Number(i.line_cost || 0), 0);

    // Call Lovable AI to structure the quotation
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional rebar quotation generator. Given BOM data from an estimation project, create structured quotation line items grouped by element type. Each group should have a description, quantity (in tonnes or pieces), unit price ($/tonne or per piece), and total. Include notes about delivery terms and validity. Return JSON only using the tool provided.`,
          },
          {
            role: "user",
            content: `Generate a professional quotation for customer "${customerName}" based on this estimation project:
Project: ${project.name}
Total Weight: ${totalWeight.toFixed(2)} kg (${(totalWeight / 1000).toFixed(3)} tonnes)
Total Estimated Cost: $${totalCost.toFixed(2)}

BOM Items (${bomItems.length} items):
${JSON.stringify(bomSummary, null, 2)}

Group items by element type. Apply a 15% margin on costs. Include standard rebar industry terms.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_quotation",
              description: "Create a structured quotation with line items",
              parameters: {
                type: "object",
                properties: {
                  line_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        quantity: { type: "number" },
                        unit: { type: "string" },
                        unit_price: { type: "number" },
                        amount: { type: "number" },
                      },
                      required: ["description", "quantity", "unit", "unit_price", "amount"],
                    },
                  },
                  notes: { type: "string" },
                  validity_days: { type: "number" },
                  delivery_terms: { type: "string" },
                },
                required: ["line_items", "notes", "validity_days"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_quotation" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let quotationData: any;

    if (toolCall?.function?.arguments) {
      quotationData = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback if no tool call
      const totalWithMargin = totalCost * 1.15;
      quotationData = {
        line_items: [{
          description: `Rebar Fabrication & Supply – ${project.name}`,
          quantity: Number((totalWeight / 1000).toFixed(3)),
          unit: "tonnes",
          unit_price: totalWeight > 0 ? Number((totalWithMargin / (totalWeight / 1000)).toFixed(2)) : totalWithMargin,
          amount: Number(totalWithMargin.toFixed(2)),
        }],
        notes: "Prices valid for 30 days. Subject to material availability.",
        validity_days: 30,
      };
    }

    // Calculate total
    const quoteTotal = quotationData.line_items.reduce((s: number, li: any) => s + (li.amount || 0), 0);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (quotationData.validity_days || 30));

    // Get company_id from user profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Generate quote number
    const { count } = await serviceClient
      .from("quotes")
      .select("*", { count: "exact", head: true })
      .eq("company_id", profile?.company_id);
    const quoteNum = `QAI-${String((count || 0) + 1).padStart(4, "0")}`;

    // Insert quote
    const { data: newQuote, error: insertErr } = await serviceClient
      .from("quotes")
      .insert({
        quote_number: quoteNum,
        customer_id: project.customer_id || leadInfo?.customer_id || null,
        total_amount: quoteTotal,
        valid_until: validUntil.toISOString(),
        notes: quotationData.notes || null,
        source: "ai_estimation",
        salesperson: "AI Generated",
        company_id: profile?.company_id,
        created_by: user.id,
        status: "Draft Quotation",
        metadata: {
          line_items: quotationData.line_items,
          estimation_project_id,
          estimation_project_name: project.name,
          delivery_terms: quotationData.delivery_terms || null,
          total_weight_kg: totalWeight,
          customer_name: customerName,
          lead_id: effectiveLeadId || null,
        },
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to save quotation" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ quote: newQuote }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-generate-quotation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
