import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

/**
 * Sync sale.order.line items from Odoo for quotes/orders that have an odoo_id.
 * 
 * Modes:
 *  - POST { quoteId } → sync lines for a single quote
 *  - POST { mode: "batch" } → sync lines for all quotes missing line items
 */

const LINE_FIELDS = [
  "id", "order_id", "name", "product_uom_qty", "price_unit",
  "price_subtotal", "discount", "product_id",
];

async function odooRpc(url: string, db: string, apiKey: string, model: string, method: string, args: unknown[]) {
  const rpcArgs = [db, 2, apiKey, model, method, ...args];
  const res = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "call",
      params: { service: "object", method: "execute_kw", args: rpcArgs },
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || JSON.stringify(data.error));
  }
  return data.result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { serviceClient } = await requireAuth(req);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty */ }

    const odooUrl = Deno.env.get("ODOO_URL")!.trim();
    const odooKey = Deno.env.get("ODOO_API_KEY")!;
    const odooDB = Deno.env.get("ODOO_DATABASE")!;

    // Single quote mode
    if (body.quoteId) {
      const { data: quote, error: qErr } = await serviceClient
        .from("quotes")
        .select("id, odoo_id, metadata, company_id")
        .eq("id", body.quoteId)
        .maybeSingle();
      if (qErr || !quote) return json({ error: "Quote not found" }, 404);
      if (!quote.odoo_id) return json({ error: "Quote has no odoo_id" }, 400);

      const result = await syncLinesForQuote(serviceClient, odooUrl, odooDB, odooKey, quote);
      return json(result);
    }

    // Batch mode: find all quotes with odoo_id that don't have line items in metadata
    const allQuotes: Array<{ id: string; odoo_id: number; metadata: Record<string, unknown> | null; company_id: string }> = [];
    let from = 0;
    const PAGE = 500;
    while (true) {
      const { data, error } = await serviceClient
        .from("quotes")
        .select("id, odoo_id, metadata, company_id")
        .not("odoo_id", "is", null)
        .range(from, from + PAGE - 1);
      if (error) throw new Error("Failed to load quotes: " + error.message);
      if (!data || data.length === 0) break;
      allQuotes.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // Filter to quotes missing line items
    const needsSync = allQuotes.filter(q => {
      const meta = q.metadata as Record<string, unknown> | null;
      const lines = meta?.order_lines as unknown[] | undefined;
      return !lines || lines.length === 0;
    });

    console.log(`Batch: ${needsSync.length} quotes need line item sync (of ${allQuotes.length} total)`);

    let synced = 0, errors = 0;

    // Process in batches of 20 Odoo IDs at a time
    for (let i = 0; i < needsSync.length; i += 20) {
      const batch = needsSync.slice(i, i + 20);
      const odooIds = batch.map(q => q.odoo_id);

      try {
        const lines = await odooRpc(odooUrl, odooDB, odooKey, "sale.order.line", "search_read", [
          [[["order_id", "in", odooIds]]],
          { fields: LINE_FIELDS },
        ]);

        // Group lines by order_id
        const linesByOrder = new Map<number, Array<Record<string, unknown>>>();
        for (const line of lines) {
          const orderId = Array.isArray(line.order_id) ? line.order_id[0] : line.order_id;
          if (!linesByOrder.has(orderId)) linesByOrder.set(orderId, []);
          linesByOrder.get(orderId)!.push(line);
        }

        // Update each quote's metadata with its lines
        for (const quote of batch) {
          const orderLines = linesByOrder.get(quote.odoo_id) || [];
          const formattedLines = orderLines.map(l => ({
            odoo_line_id: l.id,
            name: l.name || "Line item",
            product_uom_qty: l.product_uom_qty || 1,
            price_unit: l.price_unit || 0,
            price_subtotal: l.price_subtotal || 0,
            discount: l.discount || 0,
            product_id: Array.isArray(l.product_id) ? l.product_id[1] : l.product_id,
          }));

          const existingMeta = (quote.metadata || {}) as Record<string, unknown>;
          const { error: uErr } = await serviceClient
            .from("quotes")
            .update({
              metadata: { ...existingMeta, order_lines: formattedLines, lines_synced_at: new Date().toISOString() },
              updated_at: new Date().toISOString(),
            })
            .eq("id", quote.id);

          if (uErr) { console.error(`Update error for quote ${quote.id}:`, uErr); errors++; }
          else {
            synced++;
            // Also populate order_items if an order exists for this quote
            await populateOrderItems(serviceClient, quote.id, formattedLines);
          }
        }
      } catch (e) {
        console.error("Batch line sync error:", e);
        errors += batch.length;
      }
    }

    return json({ synced, errors, total: needsSync.length });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("Sync error:", err);
    return json({ error: (err as Error).message || "Sync failed" }, 500);
  }
});

async function syncLinesForQuote(
  serviceClient: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  odooUrl: string, odooDB: string, odooKey: string,
  quote: { id: string; odoo_id: number; metadata: Record<string, unknown> | null; company_id: string }
) {
  const lines = await odooRpc(odooUrl, odooDB, odooKey, "sale.order.line", "search_read", [
    [[["order_id", "=", quote.odoo_id]]],
    { fields: LINE_FIELDS },
  ]);

  const formattedLines = lines.map((l: Record<string, unknown>) => ({
    odoo_line_id: l.id,
    name: l.name || "Line item",
    product_uom_qty: l.product_uom_qty || 1,
    price_unit: l.price_unit || 0,
    price_subtotal: l.price_subtotal || 0,
    discount: l.discount || 0,
    product_id: Array.isArray(l.product_id) ? l.product_id[1] : l.product_id,
  }));

  const existingMeta = (quote.metadata || {}) as Record<string, unknown>;
  await serviceClient
    .from("quotes")
    .update({
      metadata: { ...existingMeta, order_lines: formattedLines, lines_synced_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq("id", quote.id);

  // Populate order_items if order exists
  const itemsCreated = await populateOrderItems(serviceClient, quote.id, formattedLines);

  return { linesFound: formattedLines.length, itemsCreated };
}

async function populateOrderItems(
  serviceClient: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>,
  quoteId: string,
  lines: Array<Record<string, unknown>>
) {
  if (lines.length === 0) return 0;

  // Find order linked to this quote
  const { data: order } = await serviceClient
    .from("orders")
    .select("id")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (!order) return 0;

  // Check if order already has items
  const { count } = await serviceClient
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", order.id);

  if ((count || 0) > 0) return 0; // Already populated

  const items = lines.map(l => ({
    order_id: order.id,
    description: String(l.name || "Line item"),
    quantity: Number(l.product_uom_qty) || 1,
    unit_price: Number(l.price_unit) || 0,
    notes: l.discount ? `Discount: ${l.discount}%` : null,
  }));

  const { error } = await serviceClient.from("order_items").insert(items);
  if (error) {
    console.error("Failed to insert order_items:", error.message);
    return 0;
  }
  return items.length;
}
