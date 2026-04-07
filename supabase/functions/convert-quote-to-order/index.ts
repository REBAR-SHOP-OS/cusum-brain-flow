import { handleRequest } from "../_shared/requestHandler.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ userId, companyId, serviceClient: supabase, body }) => {
    const bodySchema = z.object({
      quoteId: z.string().uuid("quoteId must be a valid UUID"),
    });
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const { quoteId } = parsed.data;

    // Fetch the quote — try `quotes` first, then fall back to `sales_quotations`
    let quote: any = null;
    const { data: q1, error: qErr1 } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .maybeSingle();

    if (q1) {
      quote = q1;
    } else {
      // Fallback: check sales_quotations and resolve linked quotes row
      const { data: sq } = await supabase
        .from("sales_quotations")
        .select("*")
        .eq("id", quoteId)
        .maybeSingle();

      if (sq) {
        // Try to find linked quotes row via quote_result.quote_id or quotation_number
        const quoteResult = (sq as any).quote_result as Record<string, unknown> | null;
        const linkedQuoteId = quoteResult?.quote_id as string | undefined;

        if (linkedQuoteId) {
          const { data: linked } = await supabase
            .from("quotes")
            .select("*")
            .eq("id", linkedQuoteId)
            .maybeSingle();
          if (linked) quote = linked;
        }

        if (!quote) {
          const { data: byNum } = await supabase
            .from("quotes")
            .select("*")
            .eq("quote_number", sq.quotation_number)
            .maybeSingle();
          if (byNum) quote = byNum;
        }

        // Last resort: use sales_quotation data directly
        if (!quote) {
          quote = {
            id: sq.id,
            quote_number: sq.quotation_number,
            customer_id: null,
            total_amount: sq.amount || 0,
            status: sq.status,
            metadata: {
              customer_name: sq.customer_name || sq.customer_company,
              line_items: sq.line_items || [],
            },
          };
        }
      }
    }

    if (!quote) throw new Error("Quote not found");

    // Resolve customer_id from metadata if null
    let resolvedCustomerId = quote.customer_id;
    if (!resolvedCustomerId) {
      const metadata = quote.metadata as Record<string, unknown> | null;
      const customerName = (metadata?.customer_name as string) || (metadata?.odoo_customer as string);
      if (customerName) {
        const { data: cust } = await supabase
          .from("customers")
          .select("id")
          .ilike("name", customerName)
          .limit(1)
          .maybeSingle();
        if (cust) resolvedCustomerId = cust.id;
      }
    }

    // Validate quote status before conversion
    const CONVERTIBLE_STATUSES = ["approved", "accepted", "sent", "signed", "internally_approved", "customer_approved"];
    if (!CONVERTIBLE_STATUSES.includes(quote.status)) {
      return new Response(
        JSON.stringify({ error: `Cannot convert quote in status: ${quote.status}. Must be one of: ${CONVERTIBLE_STATUSES.join(", ")}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if order already exists for this quote
    const { data: existing } = await supabase
      .from("orders")
      .select("id, order_number")
      .eq("quote_id", quoteId)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ error: `Order ${existing.order_number} already exists for this quote`, existingOrderId: existing.id }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate order number with retry loop
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let orderNumber = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .like("order_number", `ORD-${today}%`);
      const seq = String((count || 0) + 1 + attempt).padStart(3, "0");
      orderNumber = `ORD-${today}-${seq}`;

      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          customer_id: resolvedCustomerId,
          quote_id: quoteId,
          company_id: companyId,
          total_amount: quote.total_amount || 0,
          status: "approved",
          order_kind: "commercial",
          order_date: new Date().toISOString().slice(0, 10),
          notes: `Converted from quote ${quote.quote_number}`,
        })
        .select()
        .single();

      if (!oErr) {
        // Success — extract line items
        const metadata = quote.metadata as Record<string, unknown> | null;
        const odooLines = (metadata?.order_lines || metadata?.line_items) as Array<Record<string, unknown>> | undefined;

        let itemsCreated = 0;
        if (odooLines && Array.isArray(odooLines) && odooLines.length > 0) {
          const items = odooLines.map((line) => ({
            order_id: order.id,
            description: String(line.name || line.description || "Line item"),
            quantity: Number(line.product_uom_qty || line.quantity || 1),
            unit_price: Number(line.price_unit || line.unit_price || line.unitPrice || 0),
            notes: line.notes ? String(line.notes) : null,
          }));

          const { error: iErr } = await supabase.from("order_items").insert(items);
          if (iErr) console.error("Failed to insert line items:", iErr.message);
          else itemsCreated = items.length;
        } else if (quote.total_amount && Number(quote.total_amount) > 0) {
          const { error: iErr } = await supabase.from("order_items").insert({
            order_id: order.id,
            description: `Rebar supply & fabrication (from ${quote.quote_number})`,
            quantity: 1,
            unit_price: Number(quote.total_amount),
          });
          if (!iErr) itemsCreated = 1;
        }

        return {
          success: true,
          order: { id: order.id, order_number: order.order_number, total_amount: order.total_amount },
          itemsCreated,
        };
      }

      if (!oErr.message?.includes("duplicate") && !oErr.message?.includes("unique")) {
        throw new Error(`Failed to create order: ${oErr.message}`);
      }
    }

    throw new Error("Failed to generate unique order number after 5 attempts");
  }, { functionName: "convert-quote-to-order", wrapResult: false })
);
