/**
 * Shared QuickBooks client utilities.
 * Used by wc-webhook, stripe-qb-webhook, and qb-sync-engine.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithTimeout, isTransientError, backoffWithJitter, logQBCall } from "./qbHttp.ts";

// ─── Constants ─────────────────────────────────────────────────────
export const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export const QUICKBOOKS_API_BASE = Deno.env.get("QUICKBOOKS_ENVIRONMENT") === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com";

// Default company_id — single-tenant
export const DEFAULT_COMPANY_ID = "c2e73f51-d105-4e00-86e0-11e3b346232b";

// ─── Types ─────────────────────────────────────────────────────────

export interface QBConfig {
  realm_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  company_id?: string;
}

export interface RefreshContext {
  supabase: ReturnType<typeof createClient>;
  connectionId: string;
}

// ─── Token Management ──────────────────────────────────────────────

let _refreshPromise: Promise<string> | null = null;

export async function refreshQBToken(ctx: RefreshContext, config: QBConfig): Promise<string> {
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

// ─── Authenticated QB Fetch with Retry ─────────────────────────────

export async function qbFetch(
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

export async function getCompanyQBConfig(
  svc: ReturnType<typeof createClient>,
  companyId: string,
): Promise<{ config: QBConfig; ctx: RefreshContext } | null> {
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

// ─── Find or Create QB Customer ────────────────────────────────────

export interface CustomerInput {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

/**
 * Find or create a QuickBooks customer by email.
 * Accepts a normalized CustomerInput (works for both WC and Stripe).
 */
export async function findOrCreateQBCustomer(
  config: QBConfig,
  ctx: RefreshContext,
  input: CustomerInput,
): Promise<{ id: string; name: string }> {
  const { email, firstName = "", lastName = "", company: companyName = "", phone = "", address } = input;
  const displayName = companyName || `${firstName} ${lastName}`.trim() || email;

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
    CompanyName: companyName || undefined,
    PrimaryEmailAddr: email ? { Address: email } : undefined,
    PrimaryPhone: phone ? { FreeFormNumber: phone } : undefined,
    BillAddr: address ? {
      Line1: address.line1 || undefined,
      Line2: address.line2 || undefined,
      City: address.city || undefined,
      CountrySubDivisionCode: address.state || undefined,
      PostalCode: address.postalCode || undefined,
      Country: address.country || undefined,
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

/**
 * Adapter: Convert a WooCommerce order object to CustomerInput.
 */
export function wcOrderToCustomerInput(order: Record<string, unknown>): CustomerInput {
  const billing = order.billing as Record<string, string> | undefined;
  return {
    email: billing?.email || "",
    firstName: billing?.first_name || "",
    lastName: billing?.last_name || "",
    company: billing?.company || "",
    phone: billing?.phone || "",
    address: billing ? {
      line1: billing.address_1,
      line2: billing.address_2,
      city: billing.city,
      state: billing.state,
      postalCode: billing.postcode,
      country: billing.country,
    } : undefined,
  };
}
