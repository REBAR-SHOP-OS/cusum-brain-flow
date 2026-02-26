import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithTimeout, isTransientError, backoffWithJitter, logQBCall } from "../_shared/qbHttp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Constants ─────────────────────────────────────────────────────
const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QUICKBOOKS_API_BASE = Deno.env.get("QUICKBOOKS_ENVIRONMENT") === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com";

// Default company_id — Rebar.Shop is single-tenant
const DEFAULT_COMPANY_ID = "c2e73f51-d105-4e00-86e0-11e3b346232b";

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
  // WooCommerce sends base64-encoded HMAC-SHA256
  return computed === signature;
}

// ─── QB Token Management (mirrors qb-sync-engine) ──────────────────

interface QBConfig {
  realm_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  company_id?: string;
}

interface RefreshContext {
  supabase: ReturnType<typeof createClient>;
  connectionId: string;
}

let _refreshPromise: Promise<string> | null = null;

async function refreshQBToken(ctx: RefreshContext, config: QBConfig): Promise<string> {
  const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID")!;
  const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET")!;

  const res = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: config.refresh_token }),
  });

  const tokens = await res.json();
  if (!res.ok) throw new Error("QB token refresh failed: " + JSON.stringify(tokens));

  config.access_token = tokens.access_token;
  config.refresh_token = tokens.refresh_token;
  config.expires_at = Date.now() + tokens.expires_in * 1000;

  await ctx.supabase
    .from("integration_connections")
    .update({ config: { ...config }, last_sync_at: new Date().toISOString() })
    .eq("id", ctx.connectionId);

  return tokens.access_token;
}

async function qbFetch(
  config: QBConfig,
  path: string,
  ctx: RefreshContext,
  options?: RequestInit,
  retries = 0,
): Promise<unknown> {
  // Proactive token refresh
  if (config.expires_at && config.refresh_token && config.expires_at < Date.now() + 300_000) {
    try {
      if (!_refreshPromise) _refreshPromise = refreshQBToken(ctx, config);
      await _refreshPromise;
      _refreshPromise = null;
    } catch {
      _refreshPromise = null;
    }
  }

  const MAX_RETRIES = 3;
  const url = `${QUICKBOOKS_API_BASE}/v3/company/${config.realm_id}/${path}`;
  const t0 = Date.now();

  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.access_token}`,
        Accept: "application/json",
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...options?.headers,
      },
    }, 15_000);
  } catch (err) {
    if (retries < MAX_RETRIES && String(err).includes("timed out")) {
      await new Promise((r) => setTimeout(r, backoffWithJitter(retries)));
      return qbFetch(config, path, ctx, options, retries + 1);
    }
    throw err;
  }

  if (isTransientError(res.status) && retries < MAX_RETRIES) {
    await res.text();
    await new Promise((r) => setTimeout(r, backoffWithJitter(retries)));
    return qbFetch(config, path, ctx, options, retries + 1);
  }

  if (res.status === 401 && retries === 0 && config.refresh_token) {
    await res.text();
    try {
      if (!_refreshPromise) _refreshPromise = refreshQBToken(ctx, config);
      await _refreshPromise;
      _refreshPromise = null;
      return qbFetch(config, path, ctx, options, 1);
    } catch {
      _refreshPromise = null;
      throw new Error("QB token refresh failed");
    }
  }

  const duration = Date.now() - t0;
  if (!res.ok) {
    const errorText = await res.text();
    logQBCall({ realm_id: config.realm_id, endpoint: path, duration_ms: duration, status_code: res.status, retry_count: retries, error_message: errorText });
    throw new Error(`QB API error (${res.status}) [${path}]: ${errorText}`);
  }

  logQBCall({ realm_id: config.realm_id, endpoint: path, duration_ms: duration, status_code: res.status, retry_count: retries });
  return res.json();
}

// ─── Get QB Config by Company ──────────────────────────────────────

async function getCompanyQBConfig(svc: ReturnType<typeof createClient>, companyId: string): Promise<{ config: QBConfig; ctx: RefreshContext } | null> {
  const { data: connections } = await svc
    .from("integration_connections")
    .select("*")
    .eq("integration_id", "quickbooks")
    .eq("status", "connected");

  if (!connections) return null;

  for (const conn of connections) {
    const cfg = conn.config as QBConfig | null;
    if (cfg?.company_id === companyId) {
      return { config: cfg, ctx: { supabase: svc, connectionId: conn.id } };
    }
    const { data: profile } = await svc
      .from("profiles")
      .select("company_id")
      .eq("user_id", conn.user_id)
      .maybeSingle();
    if (profile?.company_id === companyId) {
      return { config: cfg!, ctx: { supabase: svc, connectionId: conn.id } };
    }
  }
  return null;
}

// ─── Find or Create QB Customer by Email ───────────────────────────

async function findOrCreateQBCustomer(
  config: QBConfig,
  ctx: RefreshContext,
  order: Record<string, unknown>,
): Promise<{ id: string; name: string }> {
  const billing = order.billing as Record<string, string> | undefined;
  const email = billing?.email || "";
  const firstName = billing?.first_name || "";
  const lastName = billing?.last_name || "";
  const company = billing?.company || "";
  const displayName = company || `${firstName} ${lastName}`.trim() || email;
  const phone = billing?.phone || "";

  // Search by email first
  if (email) {
    const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email.replace(/'/g, "\\'")}'`;
    const data = await qbFetch(config, `query?query=${encodeURIComponent(query)}`, ctx) as Record<string, unknown>;
    const response = data.QueryResponse as Record<string, unknown> | undefined;
    const customers = (response?.Customer as Record<string, unknown>[]) || [];
    if (customers.length > 0) {
      return { id: String(customers[0].Id), name: String(customers[0].DisplayName) };
    }
  }

  // Search by display name
  const nameQuery = `SELECT * FROM Customer WHERE DisplayName = '${displayName.replace(/'/g, "\\'")}'`;
  const nameData = await qbFetch(config, `query?query=${encodeURIComponent(nameQuery)}`, ctx) as Record<string, unknown>;
  const nameResponse = nameData.QueryResponse as Record<string, unknown> | undefined;
  const nameCustomers = (nameResponse?.Customer as Record<string, unknown>[]) || [];
  if (nameCustomers.length > 0) {
    return { id: String(nameCustomers[0].Id), name: String(nameCustomers[0].DisplayName) };
  }

  // Create new customer
  const customerPayload: Record<string, unknown> = {
    DisplayName: displayName,
    GivenName: firstName || undefined,
    FamilyName: lastName || undefined,
    CompanyName: company || undefined,
    PrimaryEmailAddr: email ? { Address: email } : undefined,
    PrimaryPhone: phone ? { FreeFormNumber: phone } : undefined,
    BillAddr: billing ? {
      Line1: billing.address_1 || undefined,
      Line2: billing.address_2 || undefined,
      City: billing.city || undefined,
      CountrySubDivisionCode: billing.state || undefined,
      PostalCode: billing.postcode || undefined,
      Country: billing.country || undefined,
    } : undefined,
  };

  // Remove undefined values
  Object.keys(customerPayload).forEach((k) => {
    if (customerPayload[k] === undefined) delete customerPayload[k];
  });

  const result = await qbFetch(config, "customer", ctx, {
    method: "POST",
    body: JSON.stringify(customerPayload),
  }) as Record<string, unknown>;

  const customer = result.Customer as Record<string, unknown>;
  return { id: String(customer.Id), name: String(customer.DisplayName) };
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
          DiscountAccountRef: { value: "86" }, // Discounts account — adjust as needed
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
    SalesTermRef: { value: "1" }, // Due on receipt (already paid)
    // Apply global tax (QB calculates based on TaxCodeRef)
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

    // ── Verify WooCommerce webhook signature ──
    const wcSignature = req.headers.get("x-wc-webhook-signature");
    const wcWebhookSecret = Deno.env.get("WC_WEBHOOK_SECRET");

    if (!wcWebhookSecret) {
      console.error("[wc-webhook] WC_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!wcSignature || !(await verifyWCSignature(rawBody, wcSignature, wcWebhookSecret))) {
      console.warn("[wc-webhook] Invalid or missing webhook signature");
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

    // ── Filter: only process paid orders with processing/completed status ──
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

      // Notify admin
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

    // ── Find or create QB customer ──
    console.log(`[wc-webhook] Finding/creating QB customer for order #${orderNumber}...`);
    const qbCustomer = await findOrCreateQBCustomer(config, ctx, order);
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

    // Notify admin of failure
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
