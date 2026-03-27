import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

/** Strip commas, units, spaces from numeric strings */
const toNum = (v: unknown): number => Number(String(v ?? '').replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0;

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
    const min = row.min ?? row.min_ton ?? 0;
    const max = row.max ?? row.max_ton ?? 999999;
    if (tonnage >= min && tonnage < max) {
      const ppt = Number(row.price_per_ton ?? row.price_per_ton_cad) || 1500;
      let sdp = Number(row.shop_drawing_price ?? row.shop_drawing_cad) || 0;
      if (!sdp && row.shop_drawing_cad_formula) {
        const f = row.shop_drawing_cad_formula;
        sdp = Number(f.base || 0) + tonnage * Number(f.per_ton || 0);
      }
      if (!sdp) sdp = 2500;
      return { price_per_ton: ppt, shop_drawing_price: sdp };
    }
  }
  return { price_per_ton: 1500, shop_drawing_price: 4500 };
}

Deno.serve((req) =>
  handleRequest(req, async ({ userId, companyId, serviceClient, body }) => {
    const { estimation_project_id, lead_id, customer_name_override, delivery_distance_km, include_shop_drawings, scrap_percent } = body;
    const deliveryDistanceKm = Number(delivery_distance_km) || 0;
    const shouldIncludeShopDrawings = include_shop_drawings !== false;

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
      const weightKg = toNum(i.weight_kg);
      const isCage = (i.element_type || "").toLowerCase().includes("cage");

      if (isCage) {
        cageWeightKg += weightKg;
      } else {
        nonCageWeightKg += weightKg;
      }

      if (!barSizeGroups[barSize]) {
        barSizeGroups[barSize] = { count: 0, total_weight_kg: 0, items: [] };
      }
      barSizeGroups[barSize].count += toNum(i.quantity);
      barSizeGroups[barSize].total_weight_kg += weightKg;
      barSizeGroups[barSize].items.push({
        element: i.element_ref || i.element_type,
        mark: i.mark,
        qty: i.quantity,
        weight_kg: weightKg,
      });
    }

    // Items from ai-estimate already include waste_factor_pct (typically 5%).
    // Back out the estimation waste so we apply ONLY the user's scrap_percent.
    const rawWeightKg = bomItems.reduce((s, i) => s + toNum(i.weight_kg), 0);
    const estWastePct = Number(project.waste_factor_pct ?? 5);
    const baseWeightKg = estWastePct > 0 ? rawWeightKg / (1 + estWastePct / 100) : rawWeightKg;
    const scrapPct = Number(scrap_percent ?? pricingConfig.scrap_percentage ?? pricingConfig.default_scrap_percent ?? 15);
    const totalWithScrap = baseWeightKg * (1 + scrapPct / 100);
    const totalTonnes = totalWithScrap / 1000;
    // Back out waste for cage/non-cage splits too
    const baseCageKg = estWastePct > 0 ? cageWeightKg / (1 + estWastePct / 100) : cageWeightKg;
    const baseNonCageKg = estWastePct > 0 ? nonCageWeightKg / (1 + estWastePct / 100) : nonCageWeightKg;
    const cageTonnes = (baseCageKg * (1 + scrapPct / 100)) / 1000;
    const nonCageTonnes = (baseNonCageKg * (1 + scrapPct / 100)) / 1000;

    // ─── GUARD: Block $0 quotes ───
    if (totalWeightKg <= 0 && bomItems.length === 0) {
      return new Response(JSON.stringify({
        error: "No measurable rebar was extracted from this estimation project. Cannot generate a $0 quotation. Please re-upload the document or add items manually.",
        failure_reason: "zero_weight",
        total_weight_kg: totalWeightKg,
        item_count: bomItems.length,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── DETERMINISTIC PRICING (no AI arithmetic) ───
    const fabTable = pricingConfig.fabrication_pricing?.price_table || FALLBACK_PRICING_CONFIG.fabrication_pricing.price_table;
    const cageRate = Number(pricingConfig.cage_pricing_rule?.rate_per_ton_cad ?? pricingConfig.cage_price_per_ton_cad ?? 5500);
    const shippingPerKm = Number(pricingConfig.shipping_per_km ?? pricingConfig.shipping_per_km_cad ?? 3);
    const truckCap = Number(pricingConfig.truck_capacity_tons ?? pricingConfig.default_truck_capacity_tons ?? 7);

    const fabRate = getFabricationRate(nonCageTonnes > 0 ? nonCageTonnes : totalTonnes, fabTable);

    console.log("Pricing resolved:", { fabRate, cageRate, shippingPerKm, truckCap, scrapPct, totalTonnes, nonCageTonnes, cageTonnes });

    if (!fabRate.price_per_ton || isNaN(fabRate.price_per_ton)) {
      console.error("FATAL: price_per_ton is invalid after config resolution", fabRate);
      return new Response(JSON.stringify({ error: "Pricing configuration error: invalid fabrication rate", failure_reason: "pricing_config_error" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lineItems: any[] = [];
    
    // Line 1: Non-cage rebar fabrication & supply
    if (nonCageTonnes > 0) {
      const amount = Number((nonCageTonnes * fabRate.price_per_ton).toFixed(2));
      lineItems.push({
        description: `Rebar Fabrication & Supply`,
        detail: `${project.name} (incl. ${scrapPct}% scrap)`,
        quantity: Number(nonCageTonnes.toFixed(3)),
        unit: "tonnes",
        unit_price: fabRate.price_per_ton,
        amount,
      });
    } else if (totalTonnes > 0 && cageTonnes <= 0) {
      // All rebar, no cage distinction
      const amount = Number((totalTonnes * fabRate.price_per_ton).toFixed(2));
      lineItems.push({
        description: `Rebar Supply & Fabrication`,
        detail: `${project.name} (incl. ${scrapPct}% scrap)`,
        quantity: Number(totalTonnes.toFixed(3)),
        unit: "tonnes",
        unit_price: fabRate.price_per_ton,
        amount,
      });
    }

    // Line 2: Cage steel
    if (cageTonnes > 0) {
      const amount = Number((cageTonnes * cageRate).toFixed(2));
      lineItems.push({
        description: `Rebar Cage Fabrication & Supply`,
        quantity: Number(cageTonnes.toFixed(3)),
        unit: "tonnes",
        unit_price: cageRate,
        amount,
      });
    }

    // Line 3: Shop drawings (conditional)
    let shopDrawingCost = 0;
    if (shouldIncludeShopDrawings) {
      shopDrawingCost = typeof fabRate.shop_drawing_price === 'number' ? fabRate.shop_drawing_price : 2500;
      if (shopDrawingCost > 0) {
        lineItems.push({
          description: "Shop Drawings",
          quantity: 1,
          unit: "ea",
          unit_price: shopDrawingCost,
          amount: shopDrawingCost,
        });
      }
    }

    // Line 4: Delivery (conditional)
    let shippingCost = 0;
    if (deliveryDistanceKm > 0) {
      const trips = Math.max(1, Math.ceil(totalTonnes / truckCap));
      shippingCost = Number((trips * deliveryDistanceKm * shippingPerKm * 2).toFixed(2));
      lineItems.push({
        description: `Delivery`,
        detail: `${deliveryDistanceKm} km × ${trips} trip(s) (round trip)`,
        quantity: trips,
        unit: "trips",
        unit_price: Number((deliveryDistanceKm * shippingPerKm * 2).toFixed(2)),
        amount: shippingCost,
      });
    }

    // Compute total
    const quoteTotal = lineItems.reduce((s: number, li: any) => s + (li.amount || 0), 0);

    // ─── SECOND GUARD: If deterministic pricing still produces $0 ───
    if (quoteTotal <= 0) {
      return new Response(JSON.stringify({
        error: `Pricing produced $0 total despite ${totalWeightKg.toFixed(0)} kg of rebar. This indicates a pricing configuration issue.`,
        failure_reason: "pricing_zero",
        total_weight_kg: totalWeightKg,
        total_tonnes: totalTonnes,
        item_count: bomItems.length,
      }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const inclusions = [
      "Material supply (cut & bent rebar)",
      shouldIncludeShopDrawings ? "Shop drawing preparation included" : null,
      deliveryDistanceKm > 0 ? `Delivery within ${deliveryDistanceKm} km` : null,
      "Tagging and bundling per schedule",
    ].filter(Boolean) as string[];

    const exclusions = [
      "Installation labour",
      "Engineering stamps / sealed drawings",
      deliveryDistanceKm <= 0 ? "Delivery / shipping (distance TBD)" : null,
      "Crane / unloading at site",
      "Permits and inspections",
    ].filter(Boolean) as string[];

    const assumptions = [
      "Quote based on customer-provided sizes and quantities",
      "Design by others",
      deliveryDistanceKm > 0 ? `Delivery included: ${deliveryDistanceKm} km round trip` : "Shipping distance TBD — not included in this quote",
      "Black rebar unless otherwise specified",
      `${scrapPct}% scrap factor applied`,
      "Prices valid for 30 days from quote date",
      "Subject to material availability",
    ];

    const terms = [
      "Prices valid for 30 days from quote date.",
      "Payment terms: Net 30.",
      "Full Terms & Conditions: https://cusum-brain-flow.lovable.app/terms",
    ];

    const notesText = [
      `Prices valid for 30 days. All weights include ${scrapPct}% scrap.`,
      "",
      "INCLUSIONS:",
      ...inclusions.map(i => `✅ ${i}`),
      "",
      "EXCLUSIONS:",
      ...exclusions.map(e => `➖ ${e}`),
      "",
      "TERMS & CONDITIONS:",
      ...terms.map(t => `• ${t}`),
    ].join("\n");

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
        notes: notesText,
        source: "ai_estimation",
        salesperson: "AI Generated",
        company_id: companyId,
        created_by: userId,
        status: "Draft Quotation",
        metadata: {
          line_items: lineItems,
          estimation_project_id,
          estimation_project_name: project.name,
          project_name: project.name,
          delivery_terms: null,
          total_weight_kg: totalWeightKg,
          total_weight_with_scrap_kg: totalWithScrap,
          scrap_percentage: scrapPct,
          shipping_cost: shippingCost,
          delivery_distance_km: deliveryDistanceKm,
          shop_drawing_cost: shopDrawingCost,
          include_shop_drawings: shouldIncludeShopDrawings,
          inclusions,
          exclusions,
          assumptions,
          terms,
          customer_name: customerName,
          lead_id: effectiveLeadId || null,
          pricing_method: "deterministic",
          tonnage_bracket: fabRate.price_per_ton,
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

    console.log(`Quote ${quoteNum} created: $${quoteTotal.toFixed(2)} for ${totalTonnes.toFixed(3)}t`);

    return new Response(JSON.stringify({ quote: newQuote }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }, { functionName: "ai-generate-quotation", wrapResult: false, rawResponse: true })
);
