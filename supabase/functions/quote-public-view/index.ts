import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { verifyPublicQuoteToken } from "../_shared/publicQuoteToken.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quote_id, public_token } = await req.json();
    if (!quote_id) {
      return new Response(JSON.stringify({ error: "quote_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await verifyPublicQuoteToken(
      typeof public_token === "string" ? public_token : undefined,
      quote_id,
      "view",
    );

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

    const viewableStatuses = ["sent", "sent_to_customer"];
    const acceptedStatuses = ["accepted", "customer_approved"];
    const rejectedStatuses = ["declined", "customer_rejected", "cancelled", "expired"];

    let pageState = "viewable"; // viewable | accepted | rejected | expired

    if (acceptedStatuses.includes(quoteStatus) || acceptedStatuses.includes(sqStatus)) {
      pageState = "accepted";
    } else if (rejectedStatuses.includes(quoteStatus) || rejectedStatuses.includes(sqStatus)) {
      pageState = "rejected";
    } else if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
      pageState = "expired";
    } else if (!viewableStatuses.includes(quoteStatus) && !viewableStatuses.includes(sqStatus)) {
      return new Response(JSON.stringify({ error: "This quotation is not publicly viewable" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    const tokenErrors = [
      "Missing public quote token",
      "Invalid token format",
      "Invalid token signature",
      "Invalid token payload",
      "Token quote mismatch",
      "Insufficient token scope",
      "Token expired",
    ];
    if (tokenErrors.includes(message)) {
      return new Response(JSON.stringify({ error: "Unauthorized quote link" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
