import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { constantTimeEqual } from "../_shared/qbHttp.ts";
import {
  DEFAULT_COMPANY_ID,
  getCompanyQBConfig,
  findOrCreateQBCustomer,
  qbFetch,
  wcOrderToCustomerInput,
} from "../_shared/qbClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── HMAC-SHA256 Signature Verification ────────────────────────────

async function verifyWCSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  console.log(`[wc-webhook] Sig check — computed: ${computed.substring(0, 10)}… received: ${signature.substring(0, 10)}… match: ${constantTimeEqual(computed, signature.trim())}`);
  return constantTimeEqual(computed, signature.trim());
}

// ─── Build QB Invoice from WC Order ────────────────────────────────

function buildInvoicePayload(
  order: Record<string, unknown>,
  qbCustomerId: string,
  qbCustomerName: string,
): Record<string, unknown> {
  const lineItems = (order.line_items as Record<string, unknown>[]) || [];
  const shippingLines = (order.shipping_lines as Record<string, unknown>[]) || [];
  const couponLines = (order.coupon_lines as Record<string, unknown>[]) || [];

  const lines: Record<string, unknown>[] = [];

  // Product lines
  for (const item of lineItems) {
    const qty = Number(item.quantity || 1);
    const unitPrice = Number(item.price || 0);
    lines.push({
      DetailType: "SalesItemLineDetail",
      Amount: qty * unitPrice,
      Description: String(item.name || "Product"),
      SalesItemLineDetail: {
        Qty: qty,
        UnitPrice: unitPrice,
        TaxCodeRef: { value: "TAX" },
      },
    });
  }

  // Shipping line
  for (const ship of shippingLines) {
    const shipAmount = Number(ship.total || 0);
    if (shipAmount > 0) {
      lines.push({
        DetailType: "SalesItemLineDetail",
        Amount: shipAmount,
        Description: `Shipping: ${String(ship.method_title || "Standard")}`,
        SalesItemLineDetail: {
          Qty: 1,
          UnitPrice: shipAmount,
          TaxCodeRef: { value: "TAX" },
        },
      });
    }
  }

  // Discount lines (negative amounts)
  for (const coupon of couponLines) {
    const discountAmount = Number(coupon.discount || 0);
    if (discountAmount > 0) {
      lines.push({
        DetailType: "DiscountLineDetail",
        Amount: discountAmount,
        DiscountLineDetail: {
          PercentBased: false,
          DiscountAccountRef: { value: "86" },
        },
      });
    }
  }

  const orderNumber = String(order.number || order.id || "");
  const orderId = String(order.id || "");

  return {
    CustomerRef: { value: qbCustomerId, name: qbCustomerName },
    Line: lines,
    DocNumber: orderNumber,
    PrivateNote: `WooCommerce Order ID: ${orderId}`,
    TxnDate: order.date_paid
      ? String(order.date_paid).substring(0, 10)
      : new Date().toISOString().substring(0, 10),
    SalesTermRef: { value: "1" },
    TxnTaxDetail: order.total_tax
      ? { TotalTax: Number(order.total_tax) }
      : undefined,
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

    // ── Read headers and classify ping vs event ──
    const wcSignature = req.headers.get("x-wc-webhook-signature");
    const wcTopic = req.headers.get("x-wc-webhook-topic");
    const wcWebhookSecret = Deno.env.get("WC_WEBHOOK_SECRET");

    console.log(`[wc-webhook] Topic: ${wcTopic}, Signature present: ${!!wcSignature}, Secret present: ${!!wcWebhookSecret}, Body length: ${rawBody.length}`);

    let pingPayload: Record<string, unknown> | null = null;
    try {
      pingPayload = JSON.parse(rawBody);
    } catch {
      pingPayload = null;
    }

    const isPingTopic = wcTopic === "action.wc_webhook_ping" || wcTopic === "action.woocommerce_webhook_ping";
    const isValidationPing = isPingTopic || (!wcSignature && !wcTopic);

    if (isValidationPing) {
      console.log("[wc-webhook] Ping/validation request received — responding 200 OK");
      return new Response(JSON.stringify({ ok: true, webhook_id: pingPayload?.webhook_id ?? pingPayload?.webhookId ?? null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!wcWebhookSecret) {
      console.error("[wc-webhook] WC_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!wcSignature) {
      console.warn("[wc-webhook] Missing x-wc-webhook-signature header");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sigValid = await verifyWCSignature(rawBody, wcSignature.trim(), wcWebhookSecret.trim());
    console.log(`[wc-webhook] Signature valid: ${sigValid}`);

    if (!sigValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse order data ──
    const order = JSON.parse(rawBody) as Record<string, unknown>;
    const orderId = Number(order.id || 0);
    const orderNumber = String(order.number || order.id || "");
    const status = String(order.status || "");
    const datePaid = order.date_paid;

    console.log(`[wc-webhook] Order #${orderNumber} (ID: ${orderId}), status: ${status}, paid: ${!!datePaid}`);

    if (!["processing", "completed"].includes(status)) {
      console.log(`[wc-webhook] Skipping order #${orderNumber} — status: ${status}`);
      return new Response(JSON.stringify({ skipped: true, reason: `Status '${status}' not eligible` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!datePaid) {
      console.log(`[wc-webhook] Skipping order #${orderNumber} — not yet paid`);
      return new Response(JSON.stringify({ skipped: true, reason: "Not paid" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = DEFAULT_COMPANY_ID;

    // ── Idempotency check ──
    const { data: existingMap } = await svc
      .from("wc_qb_order_map")
      .select("*")
      .eq("company_id", companyId)
      .eq("wc_order_id", orderId)
      .maybeSingle();

    if (existingMap?.status === "synced" && existingMap?.qb_invoice_id) {
      console.log(`[wc-webhook] Order #${orderNumber} already synced → QB Invoice ${existingMap.qb_invoice_id}`);
      return new Response(JSON.stringify({
        success: true,
        alreadyExisted: true,
        qb_invoice_id: existingMap.qb_invoice_id,
        qb_doc_number: existingMap.qb_doc_number,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Upsert pending mapping record ──
    const totalAmount = Number(order.total || 0);
    await svc.from("wc_qb_order_map").upsert({
      company_id: companyId,
      wc_order_id: orderId,
      wc_order_number: orderNumber,
      wc_status: status,
      total_amount: totalAmount,
      currency: String(order.currency || "CAD"),
      status: "pending",
      retry_count: (existingMap?.retry_count || 0) + (existingMap ? 1 : 0),
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id,wc_order_id" });

    // ── Get QB config ──
    const qbConn = await getCompanyQBConfig(svc, companyId);
    if (!qbConn) {
      const errMsg = "QuickBooks not connected for this company";
      await svc.from("wc_qb_order_map").update({
        status: "error",
        error_message: errMsg,
        updated_at: new Date().toISOString(),
      }).eq("company_id", companyId).eq("wc_order_id", orderId);

      try {
        await svc.from("notifications").insert({
          company_id: companyId,
          type: "wc_qb_sync_error",
          title: `WooCommerce Sync Failed — Order #${orderNumber}`,
          message: errMsg,
          priority: "high",
        });
      } catch {}

      throw new Error(errMsg);
    }

    const { config, ctx } = qbConn;

    // ── Find or create QB customer (using shared adapter) ──
    console.log(`[wc-webhook] Finding/creating QB customer for order #${orderNumber}...`);
    const customerInput = wcOrderToCustomerInput(order);
    const qbCustomer = await findOrCreateQBCustomer(config, ctx, customerInput);
    console.log(`[wc-webhook] QB Customer: ${qbCustomer.name} (ID: ${qbCustomer.id})`);

    // ── Create QB invoice ──
    console.log(`[wc-webhook] Creating QB invoice for order #${orderNumber}...`);
    const invoicePayload = buildInvoicePayload(order, qbCustomer.id, qbCustomer.name);
    const result = await qbFetch(config, "invoice", ctx, {
      method: "POST",
      body: JSON.stringify(invoicePayload),
    }) as Record<string, unknown>;

    const invoice = result.Invoice as Record<string, unknown>;
    const qbInvoiceId = String(invoice?.Id || "");
    const qbDocNumber = String(invoice?.DocNumber || "");

    console.log(`[wc-webhook] ✅ QB Invoice created: ID=${qbInvoiceId}, DocNumber=${qbDocNumber}`);

    // ── Update mapping to synced ──
    await svc.from("wc_qb_order_map").update({
      qb_customer_id: qbCustomer.id,
      qb_invoice_id: qbInvoiceId,
      qb_doc_number: qbDocNumber,
      status: "synced",
      error_message: null,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("company_id", companyId).eq("wc_order_id", orderId);

    // ── Audit trail ──
    try {
      await svc.from("activity_events").insert({
        company_id: companyId,
        actor_id: "system",
        actor_type: "automation",
        event_type: "wc_qb_invoice_created",
        entity_type: "Invoice",
        entity_id: qbInvoiceId,
        source: "woocommerce",
        description: `WooCommerce Order #${orderNumber} → QB Invoice ${qbDocNumber}`,
        metadata: {
          wc_order_id: orderId,
          wc_order_number: orderNumber,
          qb_invoice_id: qbInvoiceId,
          qb_doc_number: qbDocNumber,
          qb_customer_id: qbCustomer.id,
          qb_customer_name: qbCustomer.name,
          total_amount: totalAmount,
        },
        dedupe_key: `wc_qb:${orderId}:${qbInvoiceId}`,
      });
    } catch (e) {
      console.warn("[wc-webhook] Audit log failed:", e);
    }

    return new Response(JSON.stringify({
      success: true,
      wc_order_id: orderId,
      wc_order_number: orderNumber,
      qb_invoice_id: qbInvoiceId,
      qb_doc_number: qbDocNumber,
      qb_customer: qbCustomer,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[wc-webhook] Error:", error);

    try {
      await svc.from("notifications").insert({
        company_id: DEFAULT_COMPANY_ID,
        type: "wc_qb_sync_error",
        title: "WooCommerce → QuickBooks Sync Failed",
        message: error instanceof Error ? error.message : "Unknown error",
        priority: "high",
      });
    } catch {}

    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
