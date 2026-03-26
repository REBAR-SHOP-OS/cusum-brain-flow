import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

// Hardcoded fallback pricing config (Canadian rebar industry standard)
const FALLBACK_PRICING_CONFIG = {
  cage_pricing_rule: {
    rate_per_ton_cad: 5500,
    includes_shop_drawings: false,
  },
  fabrication_pricing: {
    price_table: [
      { ton_range: "Below 1", min: 0, max: 1, price_per_ton: 1800, shop_drawing_price: 500 },
      { ton_range: "1–2", min: 1, max: 2, price_per_ton: 1750, shop_drawing_price: 750 },
      { ton_range: "2–5", min: 2, max: 5, price_per_ton: 1750, shop_drawing_price: 1000 },
      { ton_range: "5–10", min: 5, max: 10, price_per_ton: 1700, shop_drawing_price: 1000 },
      { ton_range: "10–15", min: 10, max: 15, price_per_ton: 1670, shop_drawing_price: 1200 },
      { ton_range: "15–20", min: 15, max: 20, price_per_ton: 1670, shop_drawing_price: 1500 },
      { ton_range: "20–30", min: 20, max: 30, price_per_ton: 1650, shop_drawing_price: 2000 },
      { ton_range: "30–50", min: 30, max: 50, price_per_ton: 1600, shop_drawing_price: 2500 },
      { ton_range: "50–100", min: 50, max: 100, price_per_ton: 1550, shop_drawing_price: 2750 },
      { ton_range: "100+", min: 100, max: 999999, price_per_ton: 1500, shop_drawing_price: 4500 },
    ],
  },
  straight_rebars: [
    { type: "10M", length: "20'", price_per_ton: 1590 },
    { type: "15M", length: "20'", price_per_ton: 1484 },
    { type: "20M", length: "20'", price_per_ton: 1609.3 },
    { type: "25M", length: "20'", price_per_ton: 1679.58 },
    { type: "30M", length: "20'", price_per_ton: 1949.7 },
  ],
  scrap_percentage: 15,
  shipping_per_km: 3,
  truck_capacity_tons: 7,
  epoxy_galvanized_multiplier: 2,
};

function getFabricationRate(tonnage: number, table: any[]): { price_per_ton: number; shop_drawing_price: number } {
  for (const row of table) {
    if (tonnage >= (row.min ?? 0) && tonnage < (row.max ?? 999999)) {
      return { price_per_ton: row.price_per_ton, shop_drawing_price: row.shop_drawing_price };
    }
  }
  return { price_per_ton: 1500, shop_drawing_price: 4500 };
}

Deno.serve((req) =>
  handleRequest(req, async ({ userId, companyId, serviceClient, body }) => {
    const { estimation_project_id, lead_id, customer_name_override } = body;

    if (!estimation_project_id) {
      return new Response(JSON.stringify({ error: "estimation_project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // Load pricing config from DB
    const { data: pricingConfigRow } = await serviceClient
      .from("quote_pricing_configs")
      .select("pricing_data")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pricingConfig = (pricingConfigRow?.pricing_data as any) || FALLBACK_PRICING_CONFIG;

    // Build BOM summary grouped by bar size
    const barSizeGroups: Record<string, { count: number; total_weight_kg: number; items: any[] }> = {};
    let cageWeightKg = 0;
    let nonCageWeightKg = 0;

    for (const i of bomItems) {
      const barSize = i.bar_size || "unknown";
      const weightKg = Number(i.weight_kg || 0);
      const isCage = (i.element_type || "").toLowerCase().includes("cage");

      if (isCage) {
        cageWeightKg += weightKg;
      } else {
        nonCageWeightKg += weightKg;
      }

      if (!barSizeGroups[barSize]) {
        barSizeGroups[barSize] = { count: 0, total_weight_kg: 0, items: [] };
      }
      barSizeGroups[barSize].count += Number(i.quantity || 0);
      barSizeGroups[barSize].total_weight_kg += weightKg;
      barSizeGroups[barSize].items.push({
        element: i.element_ref || i.element_type,
        mark: i.mark,
        qty: i.quantity,
        weight_kg: weightKg,
      });
    }

    const totalWeightKg = bomItems.reduce((s, i) => s + Number(i.weight_kg || 0), 0);
    const scrapPct = pricingConfig.scrap_percentage ?? 15;
    const totalWithScrap = totalWeightKg * (1 + scrapPct / 100);
    const totalTonnes = totalWithScrap / 1000;
    const cageTonnes = (cageWeightKg * (1 + scrapPct / 100)) / 1000;
    const nonCageTonnes = (nonCageWeightKg * (1 + scrapPct / 100)) / 1000;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build pricing rules string for the AI prompt
    const fabTable = pricingConfig.fabrication_pricing?.price_table || FALLBACK_PRICING_CONFIG.fabrication_pricing.price_table;
    const cageRate = pricingConfig.cage_pricing_rule?.rate_per_ton_cad ?? 5500;
    const shippingPerKm = pricingConfig.shipping_per_km ?? 3;
    const truckCap = pricingConfig.truck_capacity_tons ?? 7;
    const epoxyMult = pricingConfig.epoxy_galvanized_multiplier ?? 2;

    const systemPrompt = `You are a professional Canadian rebar quotation generator. You MUST use ONLY the pricing rules below. Do NOT guess or invent prices.

PRICING RULES:
1. SCRAP: Add ${scrapPct}% scrap to all rebar tonnages before pricing.
2. CAGE PRICING: All rebar cage steel (pile cages, column cages, pier cages, drilled shaft cages) = CAD $${cageRate}/ton. Shop drawings are NOT included — add separately.
3. NON-CAGE FABRICATION PRICING (by tonnage bracket):
${fabTable.map((r: any) => `   ${r.ton_range}: $${r.price_per_ton}/ton, Shop Drawings: $${typeof r.shop_drawing_price === 'number' ? r.shop_drawing_price : r.shop_drawing_price}`).join("\n")}
4. EPOXY/GALVANIZED: Double the fabrication price per ton (${epoxyMult}x multiplier).
5. SHIPPING: $${shippingPerKm} CAD per km per truckload, ${truckCap} tons per truck. number_of_trips = ceil(total_tonnage / ${truckCap}).
6. STRAIGHT REBAR PRICES (if applicable): ${JSON.stringify(pricingConfig.straight_rebars || FALLBACK_PRICING_CONFIG.straight_rebars)}

OUTPUT FORMAT:
- Line Items: material+fabrication, cages (if any), shop drawings, shipping
- Each line item: description, quantity (tonnes or units), unit (tonnes/ea/km), unit_price, amount
- Notes section with assumptions and exclusions
- Validity: 30 days
- Currency: CAD
- All prices must come from the rules above. Never invent rates.`;

    const barSizeSummary = Object.entries(barSizeGroups).map(([size, g]) =>
      `${size}: ${g.count} pieces, ${g.total_weight_kg.toFixed(2)} kg`
    ).join("\n");

    const userPrompt = `Generate a professional quotation for customer "${customerName}" based on this estimation project:

Project: ${project.name}
Raw Total Weight: ${totalWeightKg.toFixed(2)} kg (${(totalWeightKg / 1000).toFixed(3)} tonnes)
With ${scrapPct}% Scrap: ${totalWithScrap.toFixed(2)} kg (${totalTonnes.toFixed(3)} tonnes)
Cage Steel: ${cageTonnes.toFixed(3)} tonnes (price at $${cageRate}/ton)
Non-Cage Steel: ${nonCageTonnes.toFixed(3)} tonnes (use fabrication bracket pricing)

Bar Size Breakdown:
${barSizeSummary}

BOM Items (${bomItems.length} items):
${JSON.stringify(Object.entries(barSizeGroups).map(([size, g]) => ({ bar_size: size, total_qty: g.count, total_weight_kg: g.total_weight_kg, items: g.items })), null, 2)}

Apply the pricing rules from the system prompt. Include shop drawings as a separate line item. If no shipping distance is specified, note it as TBD in assumptions.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_quotation",
              description: "Create a structured quotation with line items using the pricing rules provided",
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
                  scrap_percentage: { type: "number" },
                  shipping_cost: { type: "number" },
                  shop_drawing_cost: { type: "number" },
                  notes: { type: "string" },
                  assumptions: {
                    type: "array",
                    items: { type: "string" },
                  },
                  validity_days: { type: "number" },
                  delivery_terms: { type: "string" },
                },
                required: ["line_items", "notes", "validity_days", "assumptions"],
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
      // Deterministic fallback using tonnage bracket pricing
      const fabRate = getFabricationRate(nonCageTonnes, fabTable);
      const nonCageCost = nonCageTonnes * fabRate.price_per_ton;
      const cageCost = cageTonnes * cageRate;
      const shopDrawingCost = fabRate.shop_drawing_price;
      const grandTotal = nonCageCost + cageCost + shopDrawingCost;

      const lineItems: any[] = [];
      if (nonCageTonnes > 0) {
        lineItems.push({
          description: `Rebar Fabrication & Supply – ${project.name} (incl. ${scrapPct}% scrap)`,
          quantity: Number(nonCageTonnes.toFixed(3)),
          unit: "tonnes",
          unit_price: fabRate.price_per_ton,
          amount: Number(nonCageCost.toFixed(2)),
        });
      }
      if (cageTonnes > 0) {
        lineItems.push({
          description: `Rebar Cage Fabrication & Supply – ${project.name}`,
          quantity: Number(cageTonnes.toFixed(3)),
          unit: "tonnes",
          unit_price: cageRate,
          amount: Number(cageCost.toFixed(2)),
        });
      }
      if (shopDrawingCost > 0) {
        lineItems.push({
          description: "Shop Drawings",
          quantity: 1,
          unit: "ea",
          unit_price: shopDrawingCost,
          amount: shopDrawingCost,
        });
      }
      if (lineItems.length === 0) {
        lineItems.push({
          description: `Rebar Supply – ${project.name}`,
          quantity: Number(totalTonnes.toFixed(3)),
          unit: "tonnes",
          unit_price: fabRate.price_per_ton,
          amount: Number((totalTonnes * fabRate.price_per_ton).toFixed(2)),
        });
      }

      quotationData = {
        line_items: lineItems,
        scrap_percentage: scrapPct,
        shop_drawing_cost: shopDrawingCost,
        notes: "Prices valid for 30 days. Subject to material availability. All weights include 15% scrap allowance.",
        assumptions: [
          "Quote based on customer-provided sizes and quantities",
          "Design by others",
          "Shipping distance TBD — not included",
          "Black rebar unless otherwise specified",
          `${scrapPct}% scrap factor applied`,
        ],
        validity_days: 30,
      };
    }

    const quoteTotal = quotationData.line_items.reduce((s: number, li: any) => s + (li.amount || 0), 0);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (quotationData.validity_days || 30));

    // Generate quote number
    const { count } = await serviceClient
      .from("quotes")
      .select("*", { count: "exact", head: true })
      .eq("company_id", companyId);
    const quoteNum = `QAI-${String((count || 0) + 1).padStart(4, "0")}`;

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
        company_id: companyId,
        created_by: userId,
        status: "Draft Quotation",
        metadata: {
          line_items: quotationData.line_items,
          estimation_project_id,
          estimation_project_name: project.name,
          delivery_terms: quotationData.delivery_terms || null,
          total_weight_kg: totalWeightKg,
          total_weight_with_scrap_kg: totalWithScrap,
          scrap_percentage: quotationData.scrap_percentage || scrapPct,
          shipping_cost: quotationData.shipping_cost || 0,
          shop_drawing_cost: quotationData.shop_drawing_cost || 0,
          assumptions: quotationData.assumptions || [],
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
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }, { functionName: "ai-generate-quotation", wrapResult: false, rawResponse: true })
);
