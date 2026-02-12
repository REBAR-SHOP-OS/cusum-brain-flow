import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await anonClient.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user's company
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.company_id) throw new Error("No company assigned");
    const companyId = profile.company_id;

    const body = await req.json();
    const { quoteId } = body;
    if (!quoteId) throw new Error("quoteId is required");

    // Fetch the quote
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .maybeSingle();
    if (qErr || !quote) throw new Error("Quote not found");

    // Check if order already exists for this quote
    const { data: existing } = await supabase
      .from("orders")
      .select("id, order_number")
      .eq("quote_id", quoteId)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ error: `Order ${existing.order_number} already exists for this quote`, existingOrderId: existing.id }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate order number (ORD-YYYYMMDD-NNN)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .like("order_number", `ORD-${today}%`);
    const seq = String((count || 0) + 1).padStart(3, "0");
    const orderNumber = `ORD-${today}-${seq}`;

    // Create the order
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: quote.customer_id,
        quote_id: quoteId,
        company_id: companyId,
        total_amount: quote.total_amount || 0,
        status: "pending",
        order_date: new Date().toISOString().slice(0, 10),
        notes: `Converted from quote ${quote.quote_number}`,
      })
      .select()
      .single();
    if (oErr) throw new Error(`Failed to create order: ${oErr.message}`);

    // Try to extract line items from quote metadata
    const metadata = quote.metadata as Record<string, unknown> | null;
    const odooLines = (metadata?.order_lines || metadata?.line_items) as Array<Record<string, unknown>> | undefined;

    let itemsCreated = 0;
    if (odooLines && Array.isArray(odooLines) && odooLines.length > 0) {
      const items = odooLines.map((line) => ({
        order_id: order.id,
        description: String(line.name || line.description || "Line item"),
        quantity: Number(line.product_uom_qty || line.quantity || 1),
        unit_price: Number(line.price_unit || line.unit_price || 0),
        notes: line.notes ? String(line.notes) : null,
      }));

      const { error: iErr } = await supabase.from("order_items").insert(items);
      if (iErr) console.error("Failed to insert line items:", iErr.message);
      else itemsCreated = items.length;
    } else if (quote.total_amount && Number(quote.total_amount) > 0) {
      // Create a single line item with the total
      const { error: iErr } = await supabase.from("order_items").insert({
        order_id: order.id,
        description: `Rebar supply & fabrication (from ${quote.quote_number})`,
        quantity: 1,
        unit_price: Number(quote.total_amount),
      });
      if (!iErr) itemsCreated = 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        order: { id: order.id, order_number: order.order_number, total_amount: order.total_amount },
        itemsCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("convert-quote-to-order error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
