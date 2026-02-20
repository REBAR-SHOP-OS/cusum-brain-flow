/**
 * Quote Calculation Engine — Deterministic pricing math for Rebar.Shop
 * No AI. All pricing from pricing_config JSON only.
 * Canadian metric bar sizes (10M–55M).
 */

// ─── Types ───

export interface PricingConfig {
  straight_rebars: { bar_size: string; length_ft: number; price_each_cad: number }[];
  fabrication_pricing: {
    price_table: { min_ton: number; max_ton: number; price_per_ton_cad: number }[];
    shop_drawing_per_ton_cad: number;
  };
  dowels: { type: string; size: string; price_each_cad: number }[];
  ties_circular: { type: string; diameter: string; price_each_cad: number }[];
  cage_price_per_ton_cad: number;
  coating_multipliers: Record<string, number>;
  shipping_per_km_cad: number;
  default_truck_capacity_tons: number;
  default_scrap_percent: number;
}

export interface RebarSizeRow {
  bar_code: string;
  mass_kg_per_m: number;
  diameter_mm: number;
}

export interface EstimateRequest {
  meta: {
    request_id: string;
    quote_type: string;
    currency: string;
    created_by: string;
    created_at: string;
  };
  project: {
    project_name: string;
    customer_name: string;
    site_address: string;
    quote_date: string;
    notes: string;
  };
  scope: {
    coating_type: string;
    shop_drawings_required: boolean;
    scrap_percent_override: number | null;
    tax_rate: number;
    straight_rebar_lines: StraightLine[];
    fabricated_rebar_lines: FabricatedLine[];
    dowels: DowelLine[];
    ties_circular: TieLine[];
    cages: CageLine[];
    mesh: MeshLine[];
  };
  shipping: {
    delivery_required: boolean;
    distance_km: number;
    truck_capacity_tons: number;
    notes: string;
  };
  customer_confirmations: Record<string, boolean>;
}

export interface StraightLine {
  line_id: string;
  bar_size: string;
  length_ft: number;
  quantity: number;
  notes?: string;
}

export interface FabricatedLine {
  line_id: string;
  bar_size: string;
  shape_code: string;
  cut_length_ft: number;
  quantity: number;
  notes?: string;
}

export interface DowelLine {
  line_id: string;
  type: string;
  size: string;
  quantity: number;
  notes?: string;
}

export interface TieLine {
  line_id: string;
  type: string;
  diameter: string;
  quantity: number;
  notes?: string;
}

export interface CageLine {
  line_id: string;
  cage_type: string;
  total_cage_weight_kg: number;
  quantity: number;
  notes?: string;
}

export interface MeshLine {
  line_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cad: number | null;
  notes?: string;
}

export interface QuoteLineItem {
  category: string;
  description: string;
  bar_size: string;
  qty: number;
  length_or_weight: string;
  weight_kg: number;
  tonnage: number;
  unit_price_cad: number;
  extended_price_cad: number;
  notes: string;
}

export interface QuoteResult {
  quote_id: string | null;
  summary: {
    project_name: string;
    customer_name: string;
    quote_date: string;
    coating_type: string;
    subtotal: number;
    tax: number;
    grand_total: number;
  };
  line_items: QuoteLineItem[];
  spreadsheet_table: string[][];
  weights_summary: {
    straight_kg: number;
    fabricated_kg: number;
    cage_kg: number;
    total_kg: number;
    total_tons: number;
    scrap_tons: number;
  };
  pricing_method_summary: {
    tonnage_bracket_used: string;
    cage_rate: number;
    coating_multiplier: number;
    shipping_trips: number;
  };
  assumptions_and_exclusions: string[];
  missing_inputs_questions: string[] | null;
}

// ─── Core Calculation Functions ───

export function computeStraightBarPrice(
  line: StraightLine,
  config: PricingConfig
): { unit_price: number; extended: number; found: boolean } {
  const match = config.straight_rebars.find(
    (r) => r.bar_size === line.bar_size && r.length_ft === line.length_ft
  );
  if (!match) return { unit_price: 0, extended: 0, found: false };
  return {
    unit_price: match.price_each_cad,
    extended: round2(match.price_each_cad * line.quantity),
    found: true,
  };
}

export function computeFabricatedWeight(
  line: FabricatedLine,
  rebarSizes: RebarSizeRow[]
): { weight_per_bar_kg: number; total_weight_kg: number; found: boolean } {
  const size = rebarSizes.find((r) => r.bar_code === line.bar_size);
  if (!size) return { weight_per_bar_kg: 0, total_weight_kg: 0, found: false };
  const length_m = line.cut_length_ft * 0.3048;
  const weight_per_bar_kg = length_m * size.mass_kg_per_m;
  return {
    weight_per_bar_kg: round3(weight_per_bar_kg),
    total_weight_kg: round3(weight_per_bar_kg * line.quantity),
    found: true,
  };
}

export function selectTonnageBracket(
  totalTons: number,
  priceTable: PricingConfig["fabrication_pricing"]["price_table"]
): { price_per_ton: number; bracket_label: string } {
  for (const b of priceTable) {
    if (totalTons >= b.min_ton && totalTons < b.max_ton) {
      return {
        price_per_ton: b.price_per_ton_cad,
        bracket_label: `${b.min_ton}–${b.max_ton}t @ $${b.price_per_ton_cad}/t`,
      };
    }
  }
  // fallback to last bracket
  const last = priceTable[priceTable.length - 1];
  return {
    price_per_ton: last.price_per_ton_cad,
    bracket_label: `${last.min_ton}+t @ $${last.price_per_ton_cad}/t`,
  };
}

export function computeCagePrice(
  cage: CageLine,
  config: PricingConfig,
  scrapPct: number
): { weight_kg: number; tonnage: number; cost: number } {
  const raw_kg = cage.total_cage_weight_kg * cage.quantity;
  const with_scrap = applyScrap(raw_kg, scrapPct);
  const tonnage = with_scrap / 1000;
  return {
    weight_kg: round3(with_scrap),
    tonnage: round3(tonnage),
    cost: round2(tonnage * config.cage_price_per_ton_cad),
  };
}

export function computeShipping(
  distKm: number,
  totalTons: number,
  truckCap: number,
  ratePerKm: number
): { trips: number; cost: number } {
  if (distKm <= 0 || totalTons <= 0) return { trips: 0, cost: 0 };
  const trips = Math.ceil(totalTons / truckCap);
  return { trips, cost: round2(distKm * ratePerKm * trips) };
}

export function applyCoatingMultiplier(
  baseCost: number,
  coatingType: string,
  multipliers: Record<string, number>
): number {
  const mult = multipliers[coatingType] ?? 1;
  return round2(baseCost * mult);
}

export function applyScrap(weightKg: number, scrapPct: number): number {
  return weightKg * (1 + scrapPct / 100);
}

// ─── Validation ───

export function validateEstimateRequest(
  req: EstimateRequest,
  config: PricingConfig
): string[] {
  const questions: string[] = [];

  // Check straight bars exist in config
  for (const line of req.scope.straight_rebar_lines) {
    if (line.quantity <= 0) {
      questions.push(`Straight bar ${line.line_id}: quantity is 0 or missing.`);
    }
    const match = config.straight_rebars.find(
      (r) => r.bar_size === line.bar_size && r.length_ft === line.length_ft
    );
    if (!match && line.quantity > 0) {
      questions.push(
        `Straight bar ${line.line_id}: ${line.bar_size} @ ${line.length_ft}ft not found in pricing config.`
      );
    }
  }

  // Check fabricated bars
  for (const line of req.scope.fabricated_rebar_lines) {
    if (line.quantity <= 0) {
      questions.push(`Fabricated bar ${line.line_id}: quantity is 0 or missing.`);
    }
    if (line.cut_length_ft <= 0) {
      questions.push(`Fabricated bar ${line.line_id}: cut_length_ft is 0 or missing.`);
    }
  }

  // Check dowels
  for (const line of req.scope.dowels) {
    if (line.quantity <= 0) {
      questions.push(`Dowel ${line.line_id}: quantity is 0 or missing.`);
    }
    const match = config.dowels.find(
      (d) => d.type === line.type && d.size === line.size
    );
    if (!match && line.quantity > 0) {
      questions.push(
        `Dowel ${line.line_id}: ${line.type} / ${line.size} not found in pricing config.`
      );
    }
  }

  // Check ties
  for (const line of req.scope.ties_circular) {
    if (line.quantity <= 0) {
      questions.push(`Tie ${line.line_id}: quantity is 0 or missing.`);
    }
    const match = config.ties_circular.find(
      (t) => t.type === line.type && t.diameter === line.diameter
    );
    if (!match && line.quantity > 0) {
      questions.push(
        `Tie ${line.line_id}: ${line.type} / ${line.diameter} not found in pricing config.`
      );
    }
  }

  // Check cages
  for (const cage of req.scope.cages) {
    if (cage.total_cage_weight_kg <= 0) {
      questions.push(`Cage ${cage.line_id}: total_cage_weight_kg is 0 or missing.`);
    }
    if (cage.quantity <= 0) {
      questions.push(`Cage ${cage.line_id}: quantity is 0 or missing.`);
    }
  }

  // Shipping
  if (req.shipping.delivery_required && req.shipping.distance_km <= 0) {
    questions.push("Shipping: delivery is required but distance_km is 0 or missing.");
  }

  return questions;
}

// ─── Full Quote Pipeline ───

export function generateQuote(
  req: EstimateRequest,
  config: PricingConfig,
  rebarSizes: RebarSizeRow[]
): QuoteResult {
  const scrapPct = req.scope.scrap_percent_override ?? config.default_scrap_percent;
  const coatingType = req.scope.coating_type || "black";
  const coatingMult = config.coating_multipliers[coatingType] ?? 1;

  const lineItems: QuoteLineItem[] = [];
  let straightWeightKg = 0;
  let fabricatedWeightKg = 0;
  let cageWeightKg = 0;

  // 1. Straight bars
  for (const line of req.scope.straight_rebar_lines) {
    const priceResult = computeStraightBarPrice(line, config);
    // Estimate weight for straight bars for shipping calc
    const sizeData = rebarSizes.find((r) => r.bar_code === line.bar_size);
    const weightKg = sizeData
      ? round3(line.length_ft * 0.3048 * sizeData.mass_kg_per_m * line.quantity)
      : 0;
    straightWeightKg += weightKg;

    lineItems.push({
      category: "Straight Bars",
      description: `${line.bar_size} × ${line.length_ft}ft`,
      bar_size: line.bar_size,
      qty: line.quantity,
      length_or_weight: `${line.length_ft} ft`,
      weight_kg: weightKg,
      tonnage: round3(weightKg / 1000),
      unit_price_cad: priceResult.unit_price,
      extended_price_cad: priceResult.extended,
      notes: priceResult.found ? "" : "NOT IN PRICING CONFIG",
    });
  }

  // 2. Fabricated bars — compute weight, then price by tonnage bracket
  let totalFabWeightKg = 0;
  const fabLineDetails: {
    line: FabricatedLine;
    weightKg: number;
    found: boolean;
  }[] = [];

  for (const line of req.scope.fabricated_rebar_lines) {
    const wResult = computeFabricatedWeight(line, rebarSizes);
    totalFabWeightKg += wResult.total_weight_kg;
    fabLineDetails.push({
      line,
      weightKg: wResult.total_weight_kg,
      found: wResult.found,
    });
  }

  const fabWithScrap = applyScrap(totalFabWeightKg, scrapPct);
  const fabTonnage = fabWithScrap / 1000;
  const bracket = selectTonnageBracket(fabTonnage, config.fabrication_pricing.price_table);
  const fabBaseCost = round2(fabTonnage * bracket.price_per_ton);
  const fabCostWithCoating = applyCoatingMultiplier(fabBaseCost, coatingType, config.coating_multipliers);
  fabricatedWeightKg = fabWithScrap;

  // Distribute fabrication cost proportionally across lines
  for (const detail of fabLineDetails) {
    const proportion = totalFabWeightKg > 0 ? detail.weightKg / totalFabWeightKg : 0;
    const lineCost = round2(fabCostWithCoating * proportion);
    const lineScrapWeight = round3(applyScrap(detail.weightKg, scrapPct));

    lineItems.push({
      category: "Fabricated Bars",
      description: `${detail.line.bar_size} ${detail.line.shape_code} × ${detail.line.cut_length_ft}ft`,
      bar_size: detail.line.bar_size,
      qty: detail.line.quantity,
      length_or_weight: `${detail.line.cut_length_ft} ft`,
      weight_kg: lineScrapWeight,
      tonnage: round3(lineScrapWeight / 1000),
      unit_price_cad: round2(lineCost / detail.line.quantity),
      extended_price_cad: lineCost,
      notes: detail.found ? `Bracket: ${bracket.bracket_label}` : "BAR SIZE NOT FOUND",
    });
  }

  // 3. Dowels
  for (const line of req.scope.dowels) {
    const match = config.dowels.find(
      (d) => d.type === line.type && d.size === line.size
    );
    const unitPrice = match?.price_each_cad ?? 0;
    lineItems.push({
      category: "Dowels",
      description: `${line.type} Dowel ${line.size}`,
      bar_size: line.type,
      qty: line.quantity,
      length_or_weight: line.size,
      weight_kg: 0,
      tonnage: 0,
      unit_price_cad: unitPrice,
      extended_price_cad: round2(unitPrice * line.quantity),
      notes: match ? "" : "NOT IN PRICING CONFIG",
    });
  }

  // 4. Ties circular
  for (const line of req.scope.ties_circular) {
    const match = config.ties_circular.find(
      (t) => t.type === line.type && t.diameter === line.diameter
    );
    const unitPrice = match?.price_each_cad ?? 0;
    lineItems.push({
      category: "Ties (Circular)",
      description: `${line.type} Tie ⌀${line.diameter}`,
      bar_size: line.type,
      qty: line.quantity,
      length_or_weight: line.diameter,
      weight_kg: 0,
      tonnage: 0,
      unit_price_cad: unitPrice,
      extended_price_cad: round2(unitPrice * line.quantity),
      notes: match ? "" : "NOT IN PRICING CONFIG",
    });
  }

  // 5. Cages — always separate from fabrication tonnage
  for (const cage of req.scope.cages) {
    const cageResult = computeCagePrice(cage, config, scrapPct);
    cageWeightKg += cageResult.weight_kg;
    lineItems.push({
      category: "Cages",
      description: `${cage.cage_type} (${cage.total_cage_weight_kg} kg/cage × ${cage.quantity})`,
      bar_size: "—",
      qty: cage.quantity,
      length_or_weight: `${cage.total_cage_weight_kg} kg`,
      weight_kg: cageResult.weight_kg,
      tonnage: cageResult.tonnage,
      unit_price_cad: round2(cageResult.cost / cage.quantity),
      extended_price_cad: cageResult.cost,
      notes: `$${config.cage_price_per_ton_cad}/ton + ${scrapPct}% scrap`,
    });
  }

  // 6. Mesh
  for (const mesh of req.scope.mesh) {
    if (mesh.quantity > 0 && mesh.unit_price_cad) {
      lineItems.push({
        category: "Mesh",
        description: mesh.description,
        bar_size: "—",
        qty: mesh.quantity,
        length_or_weight: `${mesh.quantity} ${mesh.unit}`,
        weight_kg: 0,
        tonnage: 0,
        unit_price_cad: mesh.unit_price_cad,
        extended_price_cad: round2(mesh.unit_price_cad * mesh.quantity),
        notes: "",
      });
    }
  }

  // 7. Shop drawings
  const nonCageTonnage = round3((straightWeightKg + fabricatedWeightKg) / 1000);
  if (req.scope.shop_drawings_required) {
    const sdCost = round2(
      nonCageTonnage * config.fabrication_pricing.shop_drawing_per_ton_cad
    );
    lineItems.push({
      category: "Shop Drawings",
      description: "Shop drawing preparation",
      bar_size: "—",
      qty: 1,
      length_or_weight: `${nonCageTonnage} t`,
      weight_kg: 0,
      tonnage: 0,
      unit_price_cad: sdCost,
      extended_price_cad: sdCost,
      notes: `$${config.fabrication_pricing.shop_drawing_per_ton_cad}/ton`,
    });
  }

  // 8. Shipping
  const totalWeightKg = straightWeightKg + fabricatedWeightKg + cageWeightKg;
  const totalTonnage = totalWeightKg / 1000;
  const truckCap = req.shipping.truck_capacity_tons || config.default_truck_capacity_tons;
  let shippingTrips = 0;

  if (req.shipping.delivery_required && req.shipping.distance_km > 0) {
    const ship = computeShipping(
      req.shipping.distance_km,
      totalTonnage,
      truckCap,
      config.shipping_per_km_cad
    );
    shippingTrips = ship.trips;
    lineItems.push({
      category: "Shipping",
      description: `Delivery ${req.shipping.distance_km} km × ${ship.trips} trip(s)`,
      bar_size: "—",
      qty: ship.trips,
      length_or_weight: `${req.shipping.distance_km} km`,
      weight_kg: 0,
      tonnage: round3(totalTonnage),
      unit_price_cad: round2(req.shipping.distance_km * config.shipping_per_km_cad),
      extended_price_cad: ship.cost,
      notes: `ceil(${round3(totalTonnage)}t / ${truckCap}t) = ${ship.trips} trips`,
    });
  }

  // 9. Totals
  const subtotal = lineItems.reduce((s, li) => s + li.extended_price_cad, 0);
  const tax = round2(subtotal * (req.scope.tax_rate || 0));
  const grandTotal = round2(subtotal + tax);

  // 10. Spreadsheet table
  const spreadsheet = buildSpreadsheetTable(lineItems);

  // 11. Assumptions
  const assumptions = buildAssumptions(req, config, scrapPct, coatingType);

  const scrapTons = round3(totalTonnage - (straightWeightKg + totalFabWeightKg + (cageWeightKg / (1 + scrapPct / 100))) / 1000);

  return {
    quote_id: null,
    summary: {
      project_name: req.project.project_name,
      customer_name: req.project.customer_name,
      quote_date: req.project.quote_date,
      coating_type: coatingType,
      subtotal: round2(subtotal),
      tax,
      grand_total: grandTotal,
    },
    line_items: lineItems,
    spreadsheet_table: spreadsheet,
    weights_summary: {
      straight_kg: round3(straightWeightKg),
      fabricated_kg: round3(fabricatedWeightKg),
      cage_kg: round3(cageWeightKg),
      total_kg: round3(totalWeightKg),
      total_tons: round3(totalTonnage),
      scrap_tons: round3(Math.max(0, scrapTons)),
    },
    pricing_method_summary: {
      tonnage_bracket_used: bracket.bracket_label,
      cage_rate: config.cage_price_per_ton_cad,
      coating_multiplier: coatingMult,
      shipping_trips: shippingTrips,
    },
    assumptions_and_exclusions: assumptions,
    missing_inputs_questions: null,
  };
}

// ─── Helpers ───

export function buildSpreadsheetTable(lineItems: QuoteLineItem[]): string[][] {
  const header = [
    "Category",
    "Description",
    "Bar Size",
    "Qty",
    "Length/Weight",
    "Weight (kg)",
    "Tonnage (t)",
    "Unit Price (CAD)",
    "Extended Price (CAD)",
    "Notes",
  ];
  const rows = lineItems.map((li) => [
    li.category,
    li.description,
    li.bar_size,
    String(li.qty),
    li.length_or_weight,
    li.weight_kg > 0 ? String(li.weight_kg) : "—",
    li.tonnage > 0 ? String(li.tonnage) : "—",
    `$${li.unit_price_cad.toFixed(2)}`,
    `$${li.extended_price_cad.toFixed(2)}`,
    li.notes,
  ]);
  return [header, ...rows];
}

export function buildAssumptions(
  req: EstimateRequest,
  config: PricingConfig,
  scrapPct: number,
  coatingType: string
): string[] {
  return [
    `Scrap factor: ${scrapPct}% applied to all rebar tonnages.`,
    `Coating: ${coatingType} (multiplier: ${config.coating_multipliers[coatingType] ?? 1}×).`,
    `Cage pricing at CAD $${config.cage_price_per_ton_cad}/ton — separate from fabrication brackets.`,
    `Shipping rate: CAD $${config.shipping_per_km_cad}/km per truckload (${config.default_truck_capacity_tons}t capacity).`,
    req.scope.shop_drawings_required
      ? `Shop drawings included at $${config.fabrication_pricing.shop_drawing_per_ton_cad}/ton.`
      : "Shop drawings NOT included.",
    "Prices are based on current pricing config and subject to confirmation.",
    "This quote does not include engineering, structural design, or site labour.",
    "All weights are calculated using CSA G30.18 standard bar masses.",
    "Mesh pricing is placeholder unless explicitly configured.",
    req.scope.tax_rate > 0
      ? `Tax rate: ${(req.scope.tax_rate * 100).toFixed(1)}%.`
      : "No tax applied.",
  ];
}

export function generateExplanation(
  req: EstimateRequest,
  result: QuoteResult,
  config: PricingConfig
): string {
  const lines: string[] = [];
  lines.push(`## Quote Explanation — ${result.summary.project_name}`);
  lines.push("");

  // Straight bars
  const straightItems = result.line_items.filter((li) => li.category === "Straight Bars");
  if (straightItems.length > 0) {
    lines.push("### Straight Bars");
    lines.push("Each straight bar is priced by exact match (bar_size + length_ft) from the pricing config.");
    for (const li of straightItems) {
      lines.push(`- ${li.description}: ${li.qty} pcs × $${li.unit_price_cad} = $${li.extended_price_cad}`);
    }
    lines.push("");
  }

  // Fabricated
  const fabItems = result.line_items.filter((li) => li.category === "Fabricated Bars");
  if (fabItems.length > 0) {
    lines.push("### Fabricated Bars");
    lines.push(
      `Total fabricated weight (after ${req.scope.scrap_percent_override ?? config.default_scrap_percent}% scrap): ${result.weights_summary.fabricated_kg} kg = ${round3(result.weights_summary.fabricated_kg / 1000)} tons.`
    );
    lines.push(`Tonnage bracket selected: ${result.pricing_method_summary.tonnage_bracket_used}`);
    if (result.pricing_method_summary.coating_multiplier > 1) {
      lines.push(`Coating multiplier (${req.scope.coating_type}): ${result.pricing_method_summary.coating_multiplier}×`);
    }
    lines.push("");
  }

  // Cages
  const cageItems = result.line_items.filter((li) => li.category === "Cages");
  if (cageItems.length > 0) {
    lines.push("### Cages");
    lines.push(`Cages are priced at CAD $${config.cage_price_per_ton_cad}/ton (always separate from fabrication brackets).`);
    for (const li of cageItems) {
      lines.push(`- ${li.description}: ${li.tonnage}t → $${li.extended_price_cad}`);
    }
    lines.push("");
  }

  // Shipping
  const shipItems = result.line_items.filter((li) => li.category === "Shipping");
  if (shipItems.length > 0) {
    lines.push("### Shipping");
    lines.push(
      `${req.shipping.distance_km} km × $${config.shipping_per_km_cad}/km × ${result.pricing_method_summary.shipping_trips} trip(s) = $${shipItems[0].extended_price_cad}`
    );
    lines.push("");
  }

  lines.push("### Totals");
  lines.push(`- Subtotal: $${result.summary.subtotal.toFixed(2)}`);
  if (result.summary.tax > 0) lines.push(`- Tax: $${result.summary.tax.toFixed(2)}`);
  lines.push(`- **Grand Total: $${result.summary.grand_total.toFixed(2)}**`);

  return lines.join("\n");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
