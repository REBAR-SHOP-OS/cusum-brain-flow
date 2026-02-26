import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

const STRIPE_API = "https://api.stripe.com/v1";

async function stripeRequest(path: string, method: string, body?: Record<string, string>) {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");

  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body && (method === "POST" || method === "PUT")) {
    opts.body = new URLSearchParams(body).toString();
  }

  const res = await fetch(`${STRIPE_API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status}`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, serviceClient: supabase } = await requireAuth(req);
    const { action, ...params } = await req.json();

    // Get company_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single();
    if (!profile?.company_id) return json({ error: "No company" }, 400);
    const companyId = profile.company_id;

    // ── check-status ──
    if (action === "check-status") {
      try {
        const account = await stripeRequest("/account", "GET");
        return json({
          status: "connected",
          accountName: account.business_profile?.name || account.email || "Stripe Account",
          accountId: account.id,
        });
      } catch (e) {
        return json({ status: "error", error: String(e) });
      }
    }

    // ── create-payment-link ──
    if (action === "create-payment-link") {
      const { amount, currency, invoiceNumber, customerName, qbInvoiceId } = params;
      if (!amount || !qbInvoiceId) return json({ error: "amount and qbInvoiceId required" }, 400);

      // Check for existing cached link
      const { data: existing } = await supabase
        .from("stripe_payment_links")
        .select("*")
        .eq("company_id", companyId)
        .eq("qb_invoice_id", qbInvoiceId)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        return json({ paymentLink: existing });
      }

      // Create one-time price
      const amountCents = Math.round(parseFloat(amount) * 100);
      const cur = (currency || "cad").toLowerCase();

      const price = await stripeRequest("/prices", "POST", {
        unit_amount: String(amountCents),
        currency: cur,
        "product_data[name]": `Invoice #${invoiceNumber || qbInvoiceId}${customerName ? ` — ${customerName}` : ""}`,
      });

      // Create payment link
      const link = await stripeRequest("/payment_links", "POST", {
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": "1",
        "metadata[qb_invoice_id]": qbInvoiceId,
        "metadata[invoice_number]": invoiceNumber || "",
        "metadata[customer_name]": customerName || "",
      });

      // Cache in DB
      const record = {
        company_id: companyId,
        qb_invoice_id: qbInvoiceId,
        invoice_number: invoiceNumber || null,
        customer_name: customerName || null,
        stripe_price_id: price.id,
        stripe_payment_link_id: link.id,
        stripe_url: link.url,
        amount: parseFloat(amount),
        currency: cur,
        status: "active",
      };

      const { data: inserted } = await supabase
        .from("stripe_payment_links")
        .insert(record)
        .select()
        .single();

      return json({ paymentLink: inserted || { ...record, stripe_url: link.url } });
    }

    // ── get-payment-link ──
    if (action === "get-payment-link") {
      const { qbInvoiceId } = params;
      if (!qbInvoiceId) return json({ error: "qbInvoiceId required" }, 400);

      const { data: link } = await supabase
        .from("stripe_payment_links")
        .select("*")
        .eq("company_id", companyId)
        .eq("qb_invoice_id", qbInvoiceId)
        .eq("status", "active")
        .maybeSingle();

      return json({ paymentLink: link });
    }

    // ── list-payments (for reconciliation) ──
    if (action === "list-payments") {
      const { qbInvoiceId } = params;
      // Query Stripe for payment intents with our metadata
      let path = "/payment_intents?limit=100";
      if (qbInvoiceId) {
        path += `&metadata[qb_invoice_id]=${encodeURIComponent(qbInvoiceId)}`;
      }

      // Note: Stripe metadata filtering only works on certain endpoints
      // We'll query our cached links and check payment status
      const { data: links } = await supabase
        .from("stripe_payment_links")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "active");

      return json({ links: links || [] });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("stripe-payment error:", e);
    return json({ error: String(e) }, 500);
  }
});
