import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { constantTimeEqual } from "../_shared/qbHttp.ts";
import { writeEvent } from "../_shared/writeEvent.ts";
import {
  DEFAULT_COMPANY_ID,
  getCompanyQBConfig,
  findOrCreateQBCustomer,
  qbFetch,
  type CustomerInput,
} from "../_shared/qbClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// ─── Stripe Signature Verification ─────────────────────────────────

async function verifyStripeSignature(
  rawBody: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(",").reduce((acc, part) => {
    const [key, value] = part.split("=");
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  // Reject if timestamp is older than 5 minutes
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const payload = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return constantTimeEqual(computed, signature);
}

// ─── Fetch Stripe Line Items ───────────────────────────────────────

async function fetchStripeLineItems(
  sessionId: string,
  stripeSecretKey: string,
): Promise<Array<{ description: string; quantity: number; amount: number }>> {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items?limit=100`,
    {
      headers: { Authorization: `Bearer ${stripeSecretKey}` },
    },
  );
  if (!res.ok) {
    const text = await res.text();
    console.warn(`[stripe-qb] Failed to fetch line items: ${res.status} ${text}`);
    return [];
  }
  const data = await res.json();
  return (data.data || []).map((item: Record<string, unknown>) => ({
    description: String(item.description || "Stripe Purchase"),
    quantity: Number(item.quantity || 1),
    amount: Number(item.amount_total || 0) / 100,
  }));
}

// ─── Build QB Invoice Payload ──────────────────────────────────────

function buildStripeInvoicePayload(
  qbCustomerId: string,
  qbCustomerName: string,
  lineItems: Array<{ description: string; quantity: number; amount: number }>,
  docNumber: string,
  totalAmount: number,
  sessionId: string,
  taxAmount?: number,
): Record<string, unknown> {
  const lines: Record<string, unknown>[] = [];

  if (lineItems.length > 0) {
    for (const item of lineItems) {
      const unitPrice = item.quantity > 0 ? item.amount / item.quantity : item.amount;
      lines.push({
        DetailType: "SalesItemLineDetail",
        Amount: item.amount,
        Description: item.description,
        SalesItemLineDetail: {
          Qty: item.quantity,
          UnitPrice: unitPrice,
          TaxCodeRef: { value: "TAX" },
        },
      });
    }
  } else {
    // Fallback: single line item with total
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: totalAmount,
      Description: "Stripe Payment",
      SalesItemLineDetail: {
        Qty: 1,
        UnitPrice: totalAmount,
        TaxCodeRef: { value: "TAX" },
      },
    });
  }

  return {
    CustomerRef: { value: qbCustomerId, name: qbCustomerName },
    Line: lines,
    DocNumber: docNumber,
    PrivateNote: `Stripe Session: ${sessionId}`,
    TxnDate: new Date().toISOString().substring(0, 10),
    SalesTermRef: { value: "1" }, // Due on receipt (already paid)
    ...(taxAmount ? { TxnTaxDetail: { TotalTax: taxAmount } } : {}),
  };
}

// ─── Build QB Payment Payload ──────────────────────────────────────

function buildPaymentPayload(
  qbCustomerId: string,
  qbInvoiceId: string,
  totalAmount: number,
  depositAccountName: string,
): Record<string, unknown> {
  return {
    CustomerRef: { value: qbCustomerId },
    TotalAmt: totalAmount,
    Line: [
      {
        Amount: totalAmount,
        LinkedTxn: [
          {
            TxnId: qbInvoiceId,
            TxnType: "Invoice",
          },
        ],
      },
    ],
    DepositToAccountRef: { name: depositAccountName },
    PaymentMethodRef: { name: "STRIPE" },
    TxnDate: new Date().toISOString().substring(0, 10),
  };
}

// ─── Main Handler ──────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const rawBody = await req.text();
    const sigHeader = req.headers.get("stripe-signature") || "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!webhookSecret) {
      console.error("[stripe-qb] STRIPE_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify signature ──
    const sigValid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
    if (!sigValid) {
      console.warn("[stripe-qb] Invalid Stripe signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(rawBody);
    const eventType = String(event.type || "");
    console.log(`[stripe-qb] Event: ${eventType}, ID: ${event.id}`);

    // ── Event routing ──
    if (eventType !== "checkout.session.completed" && eventType !== "payment_intent.succeeded") {
      return new Response(JSON.stringify({ skipped: true, reason: `Unhandled event: ${eventType}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const obj = event.data?.object as Record<string, unknown>;
    if (!obj) {
      return new Response(JSON.stringify({ skipped: true, reason: "No event data" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Extract IDs ──
    let paymentIntentId: string;
    let sessionId: string | null = null;
    let customerEmail: string;
    let customerName: string;
    let totalAmount: number;
    let stripeCustomerId: string | null = null;

    if (eventType === "checkout.session.completed") {
      paymentIntentId = String(obj.payment_intent || "");
      sessionId = String(obj.id || "");
      const customerDetails = obj.customer_details as Record<string, string> | undefined;
      customerEmail = customerDetails?.email || String(obj.customer_email || "");
      customerName = customerDetails?.name || "";
      totalAmount = Number(obj.amount_total || 0) / 100;
      stripeCustomerId = obj.customer ? String(obj.customer) : null;

      // Skip unpaid sessions
      if (obj.payment_status !== "paid") {
        console.log(`[stripe-qb] Skipping session ${sessionId} — payment_status: ${obj.payment_status}`);
        return new Response(JSON.stringify({ skipped: true, reason: "Not paid" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // payment_intent.succeeded
      paymentIntentId = String(obj.id || "");
      const charges = (obj.charges as Record<string, unknown>)?.data as Record<string, unknown>[] | undefined;
      const latestCharge = charges?.[0];
      const billingDetails = latestCharge?.billing_details as Record<string, unknown> | undefined;
      customerEmail = String(billingDetails?.email || obj.receipt_email || "");
      customerName = String(billingDetails?.name || "");
      totalAmount = Number(obj.amount || 0) / 100;
      stripeCustomerId = obj.customer ? String(obj.customer) : null;
    }

    if (!paymentIntentId) {
      return new Response(JSON.stringify({ skipped: true, reason: "No payment_intent ID" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = DEFAULT_COMPANY_ID;

    // ── Idempotency check ──
    const { data: existingSync } = await svc
      .from("stripe_qb_sync_map")
      .select("*")
      .eq("company_id", companyId)
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (existingSync?.qb_invoice_id && existingSync?.qb_payment_id) {
      console.log(`[stripe-qb] Already synced: PI=${paymentIntentId} → Invoice=${existingSync.qb_invoice_id}, Payment=${existingSync.qb_payment_id}`);
      return new Response(JSON.stringify({
        success: true,
        alreadyExisted: true,
        qb_invoice_id: existingSync.qb_invoice_id,
        qb_payment_id: existingSync.qb_payment_id,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Upsert pending sync record ──
    await svc.from("stripe_qb_sync_map").upsert({
      company_id: companyId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_session_id: sessionId,
      stripe_customer_id: stripeCustomerId,
      customer_email: customerEmail,
      total_amount: totalAmount,
      status: "pending",
      retry_count: (existingSync?.retry_count || 0) + (existingSync ? 1 : 0),
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id,stripe_payment_intent_id" });

    // ── Get QB config ──
    const qbConn = await getCompanyQBConfig(svc, companyId);
    if (!qbConn) {
      const errMsg = "QuickBooks not connected for this company";
      await svc.from("stripe_qb_sync_map").update({
        status: "error",
        error_message: errMsg,
        updated_at: new Date().toISOString(),
      }).eq("company_id", companyId).eq("stripe_payment_intent_id", paymentIntentId);

      await notifyError(svc, companyId, `Stripe→QB Sync Failed`, errMsg);
      throw new Error(errMsg);
    }

    const { config, ctx } = qbConn;

    // ── Find or create QB customer ──
    const nameParts = customerName.split(" ");
    const customerInput: CustomerInput = {
      email: customerEmail,
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" ") || "",
    };

    console.log(`[stripe-qb] Finding/creating QB customer: ${customerEmail || customerName}`);
    const qbCustomer = await findOrCreateQBCustomer(config, ctx, customerInput);
    console.log(`[stripe-qb] QB Customer: ${qbCustomer.name} (ID: ${qbCustomer.id})`);

    // ── Fetch line items (checkout sessions only) ──
    let lineItems: Array<{ description: string; quantity: number; amount: number }> = [];
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (sessionId && stripeSecretKey) {
      lineItems = await fetchStripeLineItems(sessionId, stripeSecretKey);
    }

    // ── DocNumber: use metadata.wc_order_number if present, else session/PI ID ──
    const metadata = obj.metadata as Record<string, string> | undefined;
    const docNumber = metadata?.wc_order_number || metadata?.order_number || (sessionId ? sessionId.substring(0, 20) : paymentIntentId.substring(0, 20));

    // ── Create QB Invoice ──
    console.log(`[stripe-qb] Creating QB Invoice, DocNumber: ${docNumber}`);
    const taxAmount = Number(obj.total_details && (obj.total_details as Record<string, unknown>).amount_tax || 0) / 100;
    const invoicePayload = buildStripeInvoicePayload(
      qbCustomer.id, qbCustomer.name, lineItems, docNumber, totalAmount, sessionId || paymentIntentId, taxAmount || undefined,
    );

    const invoiceResult = await qbFetch(config, "invoice", ctx, {
      method: "POST",
      body: JSON.stringify(invoicePayload),
    }) as Record<string, unknown>;

    const invoice = invoiceResult.Invoice as Record<string, unknown>;
    const qbInvoiceId = String(invoice?.Id || "");
    const qbDocNumber = String(invoice?.DocNumber || "");
    console.log(`[stripe-qb] ✅ QB Invoice created: ID=${qbInvoiceId}, DocNumber=${qbDocNumber}`);

    // ── Update sync map with invoice ──
    await svc.from("stripe_qb_sync_map").update({
      qb_customer_id: qbCustomer.id,
      qb_invoice_id: qbInvoiceId,
      qb_doc_number: qbDocNumber,
      updated_at: new Date().toISOString(),
    }).eq("company_id", companyId).eq("stripe_payment_intent_id", paymentIntentId);

    // ── Audit: invoice created ──
    await writeEvent(svc, {
      company_id: companyId,
      entity_type: "Invoice",
      entity_id: qbInvoiceId,
      event_type: "stripe_qb_invoice_created",
      source: "stripe",
      actor_id: "system",
      actor_type: "automation",
      automation_source: "stripe-qb-webhook",
      description: `Stripe PI ${paymentIntentId} → QB Invoice ${qbDocNumber}`,
      metadata: {
        stripe_payment_intent_id: paymentIntentId,
        stripe_session_id: sessionId,
        qb_invoice_id: qbInvoiceId,
        qb_doc_number: qbDocNumber,
        total_amount: totalAmount,
      },
    });

    // ── Create QB Payment linked to Invoice ──
    // Get deposit account from qb_company_config
    let depositAccount = "Stripe Clearing";
    try {
      const { data: companyConfig } = await svc
        .from("qb_company_config")
        .select("config")
        .eq("company_id", companyId)
        .maybeSingle();
      const cfgObj = companyConfig?.config as Record<string, unknown> | undefined;
      if (cfgObj?.stripe_deposit_account) {
        depositAccount = String(cfgObj.stripe_deposit_account);
      }
    } catch (e) {
      console.warn("[stripe-qb] Could not read deposit account config, using default:", e);
    }

    console.log(`[stripe-qb] Creating QB Payment, deposit account: "${depositAccount}"`);
    const paymentPayload = buildPaymentPayload(qbCustomer.id, qbInvoiceId, totalAmount, depositAccount);

    const paymentResult = await qbFetch(config, "payment", ctx, {
      method: "POST",
      body: JSON.stringify(paymentPayload),
    }) as Record<string, unknown>;

    const payment = paymentResult.Payment as Record<string, unknown>;
    const qbPaymentId = String(payment?.Id || "");
    console.log(`[stripe-qb] ✅ QB Payment created: ID=${qbPaymentId}`);

    // ── Update sync map to synced ──
    await svc.from("stripe_qb_sync_map").update({
      qb_payment_id: qbPaymentId,
      status: "synced",
      error_message: null,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("company_id", companyId).eq("stripe_payment_intent_id", paymentIntentId);

    // ── Audit: payment created ──
    await writeEvent(svc, {
      company_id: companyId,
      entity_type: "Payment",
      entity_id: qbPaymentId,
      event_type: "stripe_qb_payment_created",
      source: "stripe",
      actor_id: "system",
      actor_type: "automation",
      automation_source: "stripe-qb-webhook",
      description: `Stripe PI ${paymentIntentId} → QB Payment ${qbPaymentId} (Invoice ${qbDocNumber})`,
      metadata: {
        stripe_payment_intent_id: paymentIntentId,
        qb_invoice_id: qbInvoiceId,
        qb_payment_id: qbPaymentId,
        total_amount: totalAmount,
        deposit_account: depositAccount,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      stripe_payment_intent_id: paymentIntentId,
      qb_invoice_id: qbInvoiceId,
      qb_doc_number: qbDocNumber,
      qb_payment_id: qbPaymentId,
      qb_customer: qbCustomer,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[stripe-qb] Error:", error);
    await notifyError(svc, DEFAULT_COMPANY_ID, "Stripe → QuickBooks Sync Failed", error instanceof Error ? error.message : "Unknown error");

    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Helper: Notify admin of errors ────────────────────────────────

async function notifyError(
  svc: ReturnType<typeof createClient>,
  companyId: string,
  title: string,
  message: string,
): Promise<void> {
  try {
    // Find a user_id for this company to send notification
    const { data: profile } = await svc
      .from("profiles")
      .select("user_id")
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();

    if (profile?.user_id) {
      await svc.from("notifications").insert({
        user_id: profile.user_id,
        type: "stripe_qb_sync_error",
        title,
        description: message,
        priority: "high",
      });
    }
  } catch (e) {
    console.warn("[stripe-qb] Failed to insert notification:", e);
  }
}
