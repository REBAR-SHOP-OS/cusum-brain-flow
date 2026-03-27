import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quote_id } = await req.json();
    console.log(`[quote-public-view] quote_id=${quote_id}`);
    if (!quote_id) {
      return new Response(JSON.stringify({ error: "quote_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the quote
    const { data: quote, error } = await svc
      .from("quotes")
      .select("id, quote_number, total_amount, valid_until, status, metadata")
      .eq("id", quote_id)
      .single();

    if (error || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check status — only allow viewing if sent/sent_to_customer
    const meta = (quote.metadata || {}) as Record<string, any>;

    // Also check sales_quotation status
    const { data: sq } = await svc
      .from("sales_quotations")
      .select("status")
      .eq("quote_id", quote_id)
      .maybeSingle();

    const sqStatus = sq?.status || "";
    const quoteStatus = quote.status || "";

    const viewableStatuses = ["sent", "sent_to_customer", "draft", "quote_ready", "internally_approved"];
    const acceptedStatuses = ["accepted", "customer_approved"];
    const rejectedStatuses = ["declined", "customer_rejected", "cancelled", "expired"];

    let pageState = "viewable"; // viewable | accepted | rejected | expired

    if (acceptedStatuses.includes(quoteStatus) || acceptedStatuses.includes(sqStatus)) {
      pageState = "accepted";
    } else if (rejectedStatuses.includes(quoteStatus) || rejectedStatuses.includes(sqStatus)) {
      pageState = "rejected";
    } else if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
      pageState = "expired";
    }

    // Return minimal data
    const lineItems = Array.isArray(meta.line_items) ? meta.line_items : [];
    const taxRate = meta.tax_rate ?? 13;
    const totalAmount = quote.total_amount || 0;
    const subtotal = Math.round((totalAmount / (1 + taxRate / 100)) * 100) / 100;
    const taxAmount = Math.round((totalAmount - subtotal) * 100) / 100;

    return new Response(JSON.stringify({
      pageState,
      quotation_number: quote.quote_number || "DRAFT",
      customer_name: meta.customer_name || "Valued Customer",
      customer_company: meta.customer_company || null,
      line_items: lineItems.map((li: any) => ({
        description: li.description || "",
        quantity: Number(li.quantity) || 0,
        unit_price: Number(li.unitPrice ?? li.unit_price) || 0,
        amount: (Number(li.quantity) || 0) * (Number(li.unitPrice ?? li.unit_price) || 0),
      })),
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      valid_until: quote.valid_until || null,
      notes: meta.notes || "",
      terms: meta.terms || [],
      inclusions: meta.inclusions || [],
      exclusions: meta.exclusions || [],
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
