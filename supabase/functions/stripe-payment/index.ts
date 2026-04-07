import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders, json } from "../_shared/auth.ts";

const STRIPE_API = "https://api.stripe.com/v1";

async function stripeRequest(path: string, method: string, body?: Record<string, string>) {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("NO_KEY: STRIPE_SECRET_KEY not configured");
  if (key.startsWith("pk_")) throw new Error("INVALID_KEY: Using publishable key instead of secret key");
  if (key.startsWith("rk_")) throw new Error("INVALID_KEY: Restricted keys not supported");

  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    signal: AbortSignal.timeout(15000),
  };
  if (body && (method === "POST" || method === "PUT")) {
    opts.body = new URLSearchParams(body).toString();
  }

  let res: Response;
  try {
    res = await fetch(`${STRIPE_API}${path}`, opts);
  } catch (e: any) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      throw new Error("TIMEOUT: Stripe API request timed out after 15s");
    }
    throw e;
  }

  // Retry once on 5xx
  if (res.status >= 500) {
    console.warn(`Stripe 5xx (${res.status}), retrying in 2s…`);
    await new Promise(r => setTimeout(r, 2000));
    try {
      res = await fetch(`${STRIPE_API}${path}`, opts);
    } catch (e: any) {
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        throw new Error("TIMEOUT: Stripe API request timed out after 15s (retry)");
      }
      throw e;
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(`API_ERROR: ${data?.error?.message || `Stripe ${res.status}`}`);
  return data;
}

function classifyError(e: any): { status: string; errorType: string; error: string } {
  const msg = String(e?.message || e);
  if (msg.startsWith("NO_KEY:")) return { status: "error", errorType: "no_key", error: msg.slice(8) };
  if (msg.startsWith("INVALID_KEY:")) return { status: "error", errorType: "invalid_key", error: msg.slice(12) };
  if (msg.startsWith("TIMEOUT:")) return { status: "error", errorType: "timeout", error: msg.slice(9) };
  if (msg.startsWith("API_ERROR:")) return { status: "error", errorType: "api_error", error: msg.slice(10) };
  return { status: "error", errorType: "unknown", error: msg };
}

Deno.serve((req) =>
  handleRequest(req, async ({ userId, serviceClient: supabase, body }) => {
    const { action, ...params } = body;

    // Get company_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single();
    let companyId = profile?.company_id;
    if (!companyId && body.companyId) {
      // Trust companyId from body when called internally (service role)
      companyId = body.companyId;
    }
    if (!companyId) return json({ error: "No company" }, 400);

    // ── check-status ──
    if (action === "check-status") {
      try {
        const account = await stripeRequest("/account", "GET");
        return {
          status: "connected",
          accountName: account.business_profile?.name || account.email || "Stripe Account",
          accountId: account.id,
        };
      } catch (e) {
        return classifyError(e);
      }
    }

    // ── create-payment-link ──
    if (action === "create-payment-link") {
      const { amount, currency, invoiceNumber, customerName, qbInvoiceId } = params;
      if (!amount || !qbInvoiceId) return json({ error: "amount and qbInvoiceId required" }, 400);

      const { data: existing } = await supabase
        .from("stripe_payment_links")
        .select("*")
        .eq("company_id", companyId)
        .eq("qb_invoice_id", qbInvoiceId)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        return { paymentLink: existing };
      }

      const amountCents = Math.round(parseFloat(amount) * 100);
      const cur = (currency || "cad").toLowerCase();

      const price = await stripeRequest("/prices", "POST", {
        unit_amount: String(amountCents),
        currency: cur,
        "product_data[name]": `Invoice #${invoiceNumber || qbInvoiceId}${customerName ? ` — ${customerName}` : ""}`,
      });

      const link = await stripeRequest("/payment_links", "POST", {
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": "1",
        "metadata[qb_invoice_id]": qbInvoiceId,
        "metadata[invoice_number]": invoiceNumber || "",
        "metadata[customer_name]": customerName || "",
      });

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

      return { paymentLink: inserted || { ...record, stripe_url: link.url } };
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

      return { paymentLink: link };
    }

    // ── list-payments (for reconciliation) ──
    if (action === "list-payments") {
      const { data: links } = await supabase
        .from("stripe_payment_links")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "active");

      return { links: links || [] };
    }

    // ── list-charges (real Stripe payment history) ──
    if (action === "list-charges") {
      const limit = Math.min(Number(params.limit) || 100, 100);
      const charges = await stripeRequest(`/charges?limit=${limit}`, "GET");
      const succeeded = (charges.data || []).filter((c: any) => c.status === "succeeded");
      return { charges: succeeded };
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  }, { functionName: "stripe-payment", requireCompany: false, wrapResult: false })
);
