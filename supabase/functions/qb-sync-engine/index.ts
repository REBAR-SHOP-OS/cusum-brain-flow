import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithTimeout, isTransientError, backoffWithJitter, logQBCall } from "../_shared/qbHttp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QUICKBOOKS_API_BASE = Deno.env.get("QUICKBOOKS_ENVIRONMENT") === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com";

// ─── QB API helpers (mirrors quickbooks-oauth patterns) ────────────

let _refreshPromise: Promise<string> | null = null;

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
  // Proactive token refresh: if token expires within 5 minutes, refresh before making the call
  if (config.expires_at && config.refresh_token && config.expires_at < Date.now() + 300_000) {
    console.log(`[QB-sync] Proactive token refresh — expires in ${Math.round((config.expires_at - Date.now()) / 1000)}s`);
    try {
      if (!_refreshPromise) _refreshPromise = refreshQBToken(ctx, config);
      await _refreshPromise;
      _refreshPromise = null;
    } catch (err) {
      _refreshPromise = null;
      console.warn("[QB-sync] Proactive refresh failed, proceeding with current token:", err);
    }
  }

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
      },
    }, 15_000);
  } catch (err) {
    const duration = Date.now() - t0;
    logQBCall({ realm_id: config.realm_id, company_id: config.company_id, endpoint: path, duration_ms: duration, status_code: 0, retry_count: retries, error_message: String(err) });
    // Retry on timeout if under limit
    if (retries < 3 && String(err).includes("timed out")) {
      const delay = backoffWithJitter(retries);
      console.warn(`[QB-sync] Timeout on [${path}], retry ${retries + 1} in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
      return qbFetch(config, path, ctx, options, retries + 1);
    }
    throw err;
  }

  const duration = Date.now() - t0;

  // Retry on transient errors (429, 502, 503, 504)
  if (isTransientError(res.status) && retries < 3) {
    const delay = backoffWithJitter(retries);
    logQBCall({ realm_id: config.realm_id, company_id: config.company_id, endpoint: path, duration_ms: duration, status_code: res.status, retry_count: retries });
    console.warn(`[QB-sync] ${res.status} on [${path}], retry ${retries + 1} in ${delay}ms`);
    await res.text(); // consume body
    await new Promise(r => setTimeout(r, delay));
    return qbFetch(config, path, ctx, options, retries + 1);
  }

  if (res.status === 401 && retries === 0) {
    await res.text();
    if (!_refreshPromise) _refreshPromise = refreshQBToken(ctx, config);
    await _refreshPromise;
    _refreshPromise = null;
    return qbFetch(config, path, ctx, options, 1);
  }

  if (!res.ok) {
    const errorText = await res.text();
    logQBCall({ realm_id: config.realm_id, company_id: config.company_id, endpoint: path, duration_ms: duration, status_code: res.status, retry_count: retries, error_message: errorText.slice(0, 500) });
    throw new Error(`QB API error (${res.status}) [${path}]: ${errorText}`);
  }

  logQBCall({ realm_id: config.realm_id, company_id: config.company_id, endpoint: path, duration_ms: duration, status_code: res.status, retry_count: retries });
  return res.json();
}

async function qbQuery(config: QBConfig, ctx: RefreshContext, entity: string, whereClause?: string): Promise<unknown[]> {
  const all: unknown[] = [];
  let startPos = 1;
  const pageSize = 1000;
  const where = whereClause ? ` WHERE ${whereClause}` : "";

  while (true) {
    const data = await qbFetch(config, `query?query=SELECT * FROM ${entity}${where} STARTPOSITION ${startPos} MAXRESULTS ${pageSize}`, ctx) as Record<string, unknown>;
    const response = data.QueryResponse as Record<string, unknown> | undefined;
    const entities = (response?.[entity] as unknown[]) || [];
    all.push(...entities);
    if (entities.length < pageSize) break;
    startPos += pageSize;
  }
  return all;
}

// ─── Upsert helpers ────────────────────────────────────────────────

type SvcClient = ReturnType<typeof createClient>;

async function upsertAccounts(svc: SvcClient, companyId: string, realmId: string, accounts: Record<string, unknown>[]) {
  const BATCH = 100;
  let synced = 0;
  for (let i = 0; i < accounts.length; i += BATCH) {
    const batch = accounts.slice(i, i + BATCH).map(a => ({
      company_id: companyId,
      qb_realm_id: realmId,
      qb_id: String(a.Id),
      sync_token: String(a.SyncToken ?? ""),
      name: String(a.Name ?? ""),
      account_type: String(a.AccountType ?? ""),
      account_sub_type: String(a.AccountSubType ?? ""),
      current_balance: Number(a.CurrentBalance ?? 0),
      is_active: a.Active !== false,
      is_deleted: false,
      raw_json: a,
      last_synced_at: new Date().toISOString(),
    }));
    const { error, count } = await svc.from("qb_accounts").upsert(batch, { onConflict: "company_id,qb_id", count: "exact" });
    if (error) console.error("qb_accounts upsert err:", error.message);
    synced += count || batch.length;
  }
  return synced;
}

async function upsertCustomers(svc: SvcClient, companyId: string, realmId: string, customers: Record<string, unknown>[]) {
  const BATCH = 100;
  let synced = 0;
  for (let i = 0; i < customers.length; i += BATCH) {
    const batch = customers.slice(i, i + BATCH).map(c => ({
      company_id: companyId,
      qb_realm_id: realmId,
      qb_id: String(c.Id),
      sync_token: String(c.SyncToken ?? ""),
      display_name: String(c.DisplayName ?? ""),
      company_name: String(c.CompanyName ?? ""),
      balance: Number(c.Balance ?? 0),
      is_active: c.Active !== false,
      is_deleted: false,
      raw_json: c,
      last_synced_at: new Date().toISOString(),
    }));
    const { error, count } = await svc.from("qb_customers").upsert(batch, { onConflict: "company_id,qb_id", count: "exact" });
    if (error) console.error("qb_customers upsert err:", error.message);
    synced += count || batch.length;
  }
  return synced;
}

async function upsertVendors(svc: SvcClient, companyId: string, realmId: string, vendors: Record<string, unknown>[]) {
  const BATCH = 100;
  let synced = 0;
  for (let i = 0; i < vendors.length; i += BATCH) {
    const batch = vendors.slice(i, i + BATCH).map(v => ({
      company_id: companyId,
      qb_realm_id: realmId,
      qb_id: String(v.Id),
      sync_token: String(v.SyncToken ?? ""),
      display_name: String(v.DisplayName ?? ""),
      company_name: String(v.CompanyName ?? ""),
      balance: Number(v.Balance ?? 0),
      is_active: v.Active !== false,
      is_deleted: false,
      raw_json: v,
      last_synced_at: new Date().toISOString(),
    }));
    const { error, count } = await svc.from("qb_vendors").upsert(batch, { onConflict: "company_id,qb_id", count: "exact" });
    if (error) console.error("qb_vendors upsert err:", error.message);
    synced += count || batch.length;
  }
  return synced;
}

async function upsertItems(svc: SvcClient, companyId: string, realmId: string, items: Record<string, unknown>[]) {
  const BATCH = 100;
  let synced = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map(it => ({
      company_id: companyId,
      qb_realm_id: realmId,
      qb_id: String(it.Id),
      sync_token: String(it.SyncToken ?? ""),
      name: String(it.Name ?? ""),
      type: String(it.Type ?? ""),
      unit_price: Number(it.UnitPrice ?? 0),
      description: String(it.Description ?? ""),
      is_active: it.Active !== false,
      is_deleted: false,
      raw_json: it,
      last_synced_at: new Date().toISOString(),
    }));
    const { error, count } = await svc.from("qb_items").upsert(batch, { onConflict: "company_id,qb_id", count: "exact" });
    if (error) console.error("qb_items upsert err:", error.message);
    synced += count || batch.length;
  }
  return synced;
}

async function upsertTransactions(
  svc: SvcClient,
  companyId: string,
  realmId: string,
  entityType: string,
  txns: Record<string, unknown>[],
) {
  const BATCH = 100;
  let synced = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < txns.length; i += BATCH) {
    const batch = txns.slice(i, i + BATCH).map(t => {
      const custRef = t.CustomerRef as { value?: string } | undefined;
      const vendRef = t.VendorRef as { value?: string } | undefined;
      return {
        company_id: companyId,
        qb_realm_id: realmId,
        qb_id: String(t.Id),
        entity_type: entityType,
        sync_token: String(t.SyncToken ?? ""),
        txn_date: (t.TxnDate as string) || null,
        doc_number: String(t.DocNumber ?? ""),
        total_amt: Number(t.TotalAmt ?? 0),
        balance: Number(t.Balance ?? 0),
        customer_qb_id: custRef?.value || null,
        vendor_qb_id: vendRef?.value || null,
        is_voided: false,
        is_deleted: false,
        raw_json: t,
        last_synced_at: now,
      };
    });

    const { error, count } = await svc
      .from("qb_transactions")
      .upsert(batch, { onConflict: "company_id,qb_id,entity_type", count: "exact" });
    if (error) console.error(`qb_transactions (${entityType}) upsert err:`, error.message);
    synced += count || batch.length;
  }
  return synced;
}

// ─── GL Normalization ──────────────────────────────────────────────

async function normalizeToGL(
  svc: SvcClient,
  companyId: string,
  entityType: string,
  qbTxnId: string,
  txn: Record<string, unknown>,
  accountLookup: Map<string, string>, // qb_id -> uuid
  customerLookup: Map<string, string>,
  vendorLookup: Map<string, string>,
) {
  // Delete existing GL entries for this transaction (idempotent rebuild)
  const { data: existingGl } = await svc
    .from("gl_transactions")
    .select("id")
    .eq("qb_transaction_id", qbTxnId)
    .limit(1)
    .maybeSingle();

  if (existingGl) {
    await svc.from("gl_transactions").delete().eq("id", existingGl.id);
  }

  const lines = (txn.Line as Record<string, unknown>[]) || [];
  if (lines.length === 0) return;

  // Create GL transaction
  const { data: glTxn, error: glErr } = await svc
    .from("gl_transactions")
    .insert({
      company_id: companyId,
      source: "quickbooks",
      qb_transaction_id: qbTxnId,
      entity_type: entityType,
      txn_date: (txn.TxnDate as string) || null,
      currency: (txn.CurrencyRef as Record<string, unknown>)?.value as string || "USD",
      memo: (txn.PrivateNote as string) || null,
    })
    .select("id")
    .single();

  if (glErr || !glTxn) {
    console.error("GL transaction insert error:", glErr?.message);
    return;
  }

  // Build GL lines based on entity type
  const glLines: Array<{
    gl_transaction_id: string;
    account_id: string | null;
    debit: number;
    credit: number;
    customer_id: string | null;
    vendor_id: string | null;
    description: string;
  }> = [];

  const custRef = txn.CustomerRef as { value?: string } | undefined;
  const vendRef = txn.VendorRef as { value?: string } | undefined;
  const customerUuid = custRef?.value ? customerLookup.get(custRef.value) || null : null;
  const vendorUuid = vendRef?.value ? vendorLookup.get(vendRef.value) || null : null;

  for (const line of lines) {
    if (line.DetailType === "SubTotalLineDetail") continue;

    const amount = Number(line.Amount ?? 0);
    if (amount === 0) continue;
    const desc = String(line.Description ?? "");

    // Extract account reference from line detail
    let accountRef: string | null = null;
    const detail = line.SalesItemLineDetail as Record<string, unknown> | undefined
      || line.ItemBasedExpenseLineDetail as Record<string, unknown> | undefined
      || line.AccountBasedExpenseLineDetail as Record<string, unknown> | undefined;

    if (detail) {
      const accRef = (detail.AccountRef || detail.ExpenseAccountRef) as { value?: string } | undefined;
      accountRef = accRef?.value ? accountLookup.get(accRef.value) || null : null;
    }

    // For JournalEntry, use explicit posting
    if (entityType === "JournalEntry") {
      const jeDetail = line.JournalEntryLineDetail as Record<string, unknown> | undefined;
      if (jeDetail) {
        const accRef = jeDetail.AccountRef as { value?: string } | undefined;
        accountRef = accRef?.value ? accountLookup.get(accRef.value) || null : null;
        const postingType = jeDetail.PostingType as string;
        glLines.push({
          gl_transaction_id: glTxn.id,
          account_id: accountRef,
          debit: postingType === "Debit" ? amount : 0,
          credit: postingType === "Credit" ? amount : 0,
          customer_id: customerUuid,
          vendor_id: vendorUuid,
          description: desc,
        });
        continue;
      }
    }

    // Generic: debit/credit based on entity type
    if (entityType === "Invoice" || entityType === "SalesReceipt" || entityType === "Estimate") {
      // Debit AR, credit Income
      glLines.push({
        gl_transaction_id: glTxn.id,
        account_id: accountRef,
        debit: 0,
        credit: amount,
        customer_id: customerUuid,
        vendor_id: null,
        description: desc,
      });
    } else if (entityType === "Bill" || entityType === "VendorCredit") {
      // Debit Expense, credit AP
      glLines.push({
        gl_transaction_id: glTxn.id,
        account_id: accountRef,
        debit: amount,
        credit: 0,
        customer_id: null,
        vendor_id: vendorUuid,
        description: desc,
      });
    } else if (entityType === "Payment") {
      glLines.push({
        gl_transaction_id: glTxn.id,
        account_id: accountRef,
        debit: amount,
        credit: 0,
        customer_id: customerUuid,
        vendor_id: null,
        description: desc,
      });
    } else if (entityType === "CreditMemo") {
      glLines.push({
        gl_transaction_id: glTxn.id,
        account_id: accountRef,
        debit: amount,
        credit: 0,
        customer_id: customerUuid,
        vendor_id: null,
        description: desc,
      });
    } else {
      // Generic fallback — store as debit
      glLines.push({
        gl_transaction_id: glTxn.id,
        account_id: accountRef,
        debit: amount,
        credit: 0,
        customer_id: customerUuid,
        vendor_id: vendorUuid,
        description: desc,
      });
    }
  }

  if (glLines.length > 0) {
    const { error } = await svc.from("gl_lines").insert(glLines);
    if (error) console.error("GL lines insert error:", error.message);
  }
}

// ─── Build lookup maps ─────────────────────────────────────────────

async function buildLookupMap(svc: SvcClient, table: string, companyId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data } = await svc
      .from(table)
      .select("id, qb_id")
      .eq("company_id", companyId)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const rows = data || [];
    for (const r of rows) map.set(r.qb_id, r.id);
    if (rows.length < PAGE_SIZE) break;
    page++;
  }
  return map;
}

// ─── Sync Log ──────────────────────────────────────────────────────

async function logSync(
  svc: SvcClient,
  companyId: string,
  entityType: string,
  action: string,
  syncedCount: number,
  errorCount: number,
  errors: string[],
  durationMs: number,
  trialBalanceDiff?: number,
) {
  await svc.from("qb_sync_logs").insert({
    company_id: companyId,
    entity_type: entityType,
    action,
    synced_count: syncedCount,
    error_count: errorCount,
    errors: errors.slice(0, 20),
    duration_ms: durationMs,
    trial_balance_diff: trialBalanceDiff ?? null,
  });
}

// ─── Get QB connection for a company ───────────────────────────────

async function getCompanyQBConfig(svc: SvcClient, companyId: string): Promise<{ config: QBConfig; ctx: RefreshContext } | null> {
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
    // Fallback: check owner's company
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

// ─── Transaction entity types to sync ──────────────────────────────

const TXN_TYPES = [
  "Invoice", "Bill", "Payment", "CreditMemo", "JournalEntry",
  "Estimate", "PurchaseOrder", "Deposit", "Transfer", "VendorCredit", "SalesReceipt",
  "BillPayment",
];

// ─── BACKFILL ──────────────────────────────────────────────────────

async function handleBackfill(svc: SvcClient, companyId: string) {
  const t0 = Date.now();
  const conn = await getCompanyQBConfig(svc, companyId);
  if (!conn) throw new Error("QuickBooks not connected for this company");

  const { config, ctx } = conn;
  const realmId = config.realm_id;
  const results: Record<string, number> = {};
  const errors: string[] = [];

  // 1. Company Info
  try {
    const ciData = await qbFetch(config, `companyinfo/${realmId}`, ctx) as Record<string, unknown>;
    const ci = ciData.CompanyInfo as Record<string, unknown>;
    if (ci) {
      await svc.from("qb_company_info").upsert({
        company_id: companyId,
        qb_realm_id: realmId,
        raw_json: ci,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "company_id,qb_realm_id" });
      results.CompanyInfo = 1;
    }
  } catch (e) { errors.push(`CompanyInfo: ${e}`); }

  // 2. Accounts
  try {
    const accounts = await qbQuery(config, ctx, "Account") as Record<string, unknown>[];
    results.Account = await upsertAccounts(svc, companyId, realmId, accounts);
  } catch (e) { errors.push(`Account: ${e}`); }

  // 3. Items
  try {
    const items = await qbQuery(config, ctx, "Item") as Record<string, unknown>[];
    results.Item = await upsertItems(svc, companyId, realmId, items);
  } catch (e) { errors.push(`Item: ${e}`); }

  // 4. Customers
  try {
    const customers = await qbQuery(config, ctx, "Customer") as Record<string, unknown>[];
    results.Customer = await upsertCustomers(svc, companyId, realmId, customers);
  } catch (e) { errors.push(`Customer: ${e}`); }

  // 5. Vendors
  try {
    const vendors = await qbQuery(config, ctx, "Vendor") as Record<string, unknown>[];
    results.Vendor = await upsertVendors(svc, companyId, realmId, vendors);
  } catch (e) { errors.push(`Vendor: ${e}`); }

  // 6. Classes
  try {
    const classes = await qbQuery(config, ctx, "Class") as Record<string, unknown>[];
    const now = new Date().toISOString();
    for (let i = 0; i < classes.length; i += 100) {
      const batch = classes.slice(i, i + 100).map(c => ({
        company_id: companyId,
        qb_id: String(c.Id),
        name: String(c.Name ?? ""),
        parent_qb_id: (c.ParentRef as any)?.value || null,
        is_active: c.Active !== false,
        raw_json: c,
        last_synced_at: now,
      }));
      await svc.from("qb_classes").upsert(batch, { onConflict: "company_id,qb_id" });
    }
    results.Class = classes.length;
  } catch (e) { errors.push(`Class: ${e}`); }

  // 7. Departments
  try {
    const depts = await qbQuery(config, ctx, "Department") as Record<string, unknown>[];
    const now = new Date().toISOString();
    for (let i = 0; i < depts.length; i += 100) {
      const batch = depts.slice(i, i + 100).map(d => ({
        company_id: companyId,
        qb_id: String(d.Id),
        name: String(d.Name ?? ""),
        is_active: d.Active !== false,
        raw_json: d,
        last_synced_at: now,
      }));
      await svc.from("qb_departments").upsert(batch, { onConflict: "company_id,qb_id" });
    }
    results.Department = depts.length;
  } catch (e) { errors.push(`Department: ${e}`); }

  // 8. All transaction types
  // Build lookups for GL normalization
  const accountLookup = await buildLookupMap(svc, "qb_accounts", companyId);
  const customerLookup = await buildLookupMap(svc, "qb_customers", companyId);
  const vendorLookup = await buildLookupMap(svc, "qb_vendors", companyId);

  for (const entityType of TXN_TYPES) {
    try {
      const txns = await qbQuery(config, ctx, entityType) as Record<string, unknown>[];
      if (txns.length === 0) { results[entityType] = 0; continue; }
      results[entityType] = await upsertTransactions(svc, companyId, realmId, entityType, txns);

      // Normalize to GL — get the upserted rows' UUIDs
      for (const t of txns) {
        const { data: row } = await svc
          .from("qb_transactions")
          .select("id")
          .eq("company_id", companyId)
          .eq("qb_id", String(t.Id))
          .eq("entity_type", entityType)
          .maybeSingle();
        if (row) {
          await normalizeToGL(svc, companyId, entityType, row.id, t, accountLookup, customerLookup, vendorLookup);
        }
      }
    } catch (e) { errors.push(`${entityType}: ${e}`); }
  }

  const duration = Date.now() - t0;
  const totalSynced = Object.values(results).reduce((a, b) => a + b, 0);
  await logSync(svc, companyId, "ALL", "backfill", totalSynced, errors.length, errors, duration);

  return { results, errors, duration_ms: duration };
}

// ─── INCREMENTAL SYNC ──────────────────────────────────────────────

async function handleIncremental(svc: SvcClient, companyId: string) {
  const t0 = Date.now();
  const conn = await getCompanyQBConfig(svc, companyId);
  if (!conn) throw new Error("QuickBooks not connected for this company");

  const { config, ctx } = conn;
  const realmId = config.realm_id;
  const errors: string[] = [];
  let totalSynced = 0;

  // Get last sync time (most recent sync log)
  const { data: lastLog } = await svc
    .from("qb_sync_logs")
    .select("created_at")
    .eq("company_id", companyId)
    .in("action", ["backfill", "incremental"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Default to 24h ago if no previous sync
  const since = lastLog?.created_at || new Date(Date.now() - 86400000).toISOString();
  const sinceDate = since.split("T")[0];

  // Sync entities changed since last sync
  const entitySyncs: Array<{ type: string; entity: string; upsertFn: (data: Record<string, unknown>[]) => Promise<number> }> = [
    { type: "Account", entity: "Account", upsertFn: (d) => upsertAccounts(svc, companyId, realmId, d) },
    { type: "Customer", entity: "Customer", upsertFn: (d) => upsertCustomers(svc, companyId, realmId, d) },
    { type: "Vendor", entity: "Vendor", upsertFn: (d) => upsertVendors(svc, companyId, realmId, d) },
    { type: "Item", entity: "Item", upsertFn: (d) => upsertItems(svc, companyId, realmId, d) },
  ];

  for (const { type, entity, upsertFn } of entitySyncs) {
    try {
      const data = await qbQuery(config, ctx, entity, `MetaData.LastUpdatedTime > '${sinceDate}'`) as Record<string, unknown>[];
      if (data.length > 0) {
        const count = await upsertFn(data);
        totalSynced += count;
        console.log(`[incremental] ${type}: ${count} updated`);
      }
    } catch (e) { errors.push(`${type}: ${e}`); }
  }

  // Transaction types
  const accountLookup = await buildLookupMap(svc, "qb_accounts", companyId);
  const customerLookup = await buildLookupMap(svc, "qb_customers", companyId);
  const vendorLookup = await buildLookupMap(svc, "qb_vendors", companyId);

  for (const entityType of TXN_TYPES) {
    try {
      const txns = await qbQuery(config, ctx, entityType, `MetaData.LastUpdatedTime > '${sinceDate}'`) as Record<string, unknown>[];
      if (txns.length === 0) continue;

      // SyncToken check — skip unchanged
      const filteredTxns: Record<string, unknown>[] = [];
      for (const t of txns) {
        const { data: existing } = await svc
          .from("qb_transactions")
          .select("sync_token")
          .eq("company_id", companyId)
          .eq("qb_id", String(t.Id))
          .eq("entity_type", entityType)
          .maybeSingle();

        if (existing && existing.sync_token === String(t.SyncToken)) continue; // unchanged
        filteredTxns.push(t);
      }

      if (filteredTxns.length > 0) {
        const count = await upsertTransactions(svc, companyId, realmId, entityType, filteredTxns);
        totalSynced += count;

        // Rebuild GL for changed transactions
        for (const t of filteredTxns) {
          const { data: row } = await svc
            .from("qb_transactions")
            .select("id")
            .eq("company_id", companyId)
            .eq("qb_id", String(t.Id))
            .eq("entity_type", entityType)
            .maybeSingle();
          if (row) {
            await normalizeToGL(svc, companyId, entityType, row.id, t, accountLookup, customerLookup, vendorLookup);
          }
        }
      }
    } catch (e) { errors.push(`${entityType}: ${e}`); }
  }

  // Detect deletions via CDC
  try {
    const cdcData = await qbFetch(config, `cdc?changedSince=${since}&entities=${TXN_TYPES.join(",")}`, ctx) as Record<string, unknown>;
    const cdcResponse = cdcData.CDCResponse as Array<{ QueryResponse?: Array<Record<string, unknown>> }> | undefined;
    if (cdcResponse) {
      for (const resp of cdcResponse) {
        for (const qr of resp.QueryResponse || []) {
          for (const [key, value] of Object.entries(qr)) {
            if (key === "startPosition" || key === "maxResults" || key === "totalCount") continue;
            const entities = Array.isArray(value) ? value : [value];
            for (const entity of entities) {
              const e = entity as Record<string, unknown>;
              if (e.status === "Deleted") {
                await svc.from("qb_transactions")
                  .update({ is_deleted: true, last_synced_at: new Date().toISOString() })
                  .eq("company_id", companyId)
                  .eq("qb_id", String(e.Id))
                  .eq("entity_type", key);
              }
              if (e.status === "Voided") {
                await svc.from("qb_transactions")
                  .update({ is_voided: true, last_synced_at: new Date().toISOString() })
                  .eq("company_id", companyId)
                  .eq("qb_id", String(e.Id))
                  .eq("entity_type", key);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("CDC detection failed (non-fatal):", e);
    errors.push(`CDC: ${e}`);
  }

  const duration = Date.now() - t0;
  await logSync(svc, companyId, "ALL", "incremental", totalSynced, errors.length, errors, duration);

  return { synced: totalSynced, errors, duration_ms: duration };
}

// ─── RECONCILE ─────────────────────────────────────────────────────

async function handleReconcile(svc: SvcClient, companyId: string) {
  const t0 = Date.now();
  const conn = await getCompanyQBConfig(svc, companyId);
  if (!conn) throw new Error("QuickBooks not connected for this company");

  const { config, ctx } = conn;
  const errors: string[] = [];
  const accountDetails: Array<{ account: string; qb: number; erp: number; diff: number }> = [];

  // 1. Fetch QB Trial Balance — per-account breakdown
  let qbTrialBalance = 0;
  const qbAccountBalances: Record<string, { name: string; debit: number; credit: number }> = {};
  try {
    const report = await qbFetch(config, "reports/TrialBalance", ctx) as Record<string, unknown>;
    const rows = (report as Record<string, unknown>).Rows as Record<string, unknown> | undefined;
    const rowData = (rows?.Row as Array<Record<string, unknown>>) || [];
    for (const row of rowData) {
      const colData = (row.ColData as Array<{ value?: string }>) || [];
      const summary = row.Summary as Record<string, unknown> | undefined;
      if (summary) {
        const sumCols = (summary.ColData as Array<{ value?: string }>) || [];
        if (sumCols.length >= 3) {
          const debit = parseFloat(sumCols[1]?.value || "0");
          const credit = parseFloat(sumCols[2]?.value || "0");
          qbTrialBalance = debit - credit;
        }
      } else if (colData.length >= 3 && colData[0]?.value) {
        const name = colData[0].value;
        const debit = parseFloat(colData[1]?.value || "0");
        const credit = parseFloat(colData[2]?.value || "0");
        qbAccountBalances[name] = { name, debit, credit };
      }
    }
  } catch (e) { errors.push(`QB Trial Balance fetch: ${e}`); }

  // 2. Calculate ERP Trial Balance from gl_lines
  let erpTrialBalance = 0;
  try {
    const { data: debits } = await svc
      .from("gl_lines")
      .select("debit")
      .gt("debit", 0);
    const { data: credits } = await svc
      .from("gl_lines")
      .select("credit")
      .gt("credit", 0);

    const totalDebit = (debits || []).reduce((s: number, r: { debit: number }) => s + r.debit, 0);
    const totalCredit = (credits || []).reduce((s: number, r: { credit: number }) => s + r.credit, 0);
    erpTrialBalance = totalDebit - totalCredit;
  } catch (e) { errors.push(`ERP Trial Balance calc: ${e}`); }

  // 3. Per-account diffs: AR, AP from mirror tables
  let arDiff = 0;
  let apDiff = 0;
  try {
    // QB AR total from invoices mirror
    const { data: invRows } = await svc
      .from("qb_transactions")
      .select("balance")
      .eq("entity_type", "Invoice")
      .eq("is_deleted", false);
    const erpAR = (invRows || []).reduce((s: number, r: { balance: number | null }) => s + (r.balance || 0), 0);

    // QB AP total from bills mirror
    const { data: billRows } = await svc
      .from("qb_transactions")
      .select("balance")
      .eq("entity_type", "Bill")
      .eq("is_deleted", false);
    const erpAP = (billRows || []).reduce((s: number, r: { balance: number | null }) => s + (r.balance || 0), 0);

    // QB AR/AP from QB accounts
    const qbAR = qbAccountBalances["Accounts Receivable (A/R)"]?.debit || 0;
    const qbAP = qbAccountBalances["Accounts Payable (A/P)"]?.credit || 0;

    arDiff = Math.abs(erpAR - qbAR);
    apDiff = Math.abs(erpAP - qbAP);

    if (arDiff > 0.01) accountDetails.push({ account: "Accounts Receivable", qb: qbAR, erp: erpAR, diff: arDiff });
    if (apDiff > 0.01) accountDetails.push({ account: "Accounts Payable", qb: qbAP, erp: erpAP, diff: apDiff });
  } catch (e) { errors.push(`AR/AP comparison: ${e}`); }

  const diff = Math.abs(qbTrialBalance - erpTrialBalance);
  const isBalanced = diff <= 0.01 && arDiff <= 0.01 && apDiff <= 0.01;

  // 4. Persist trial balance check result (hard-stop enforcement)
  try {
    await svc.from("trial_balance_checks").insert({
      company_id: companyId,
      is_balanced: isBalanced,
      total_diff: diff,
      qb_total: qbTrialBalance,
      erp_total: erpTrialBalance,
      ar_diff: arDiff,
      ap_diff: apDiff,
      details: accountDetails,
    });
  } catch (e) { errors.push(`Persist trial balance check: ${e}`); }

  // 5. Alert if mismatch
  if (!isBalanced) {
    const detailLines = accountDetails.map(d => `${d.account}: QB=$${d.qb.toFixed(2)} ERP=$${d.erp.toFixed(2)} Diff=$${d.diff.toFixed(2)}`).join("\n");
    await svc.from("human_tasks").insert({
      company_id: companyId,
      title: `⛔ Trial Balance Mismatch: $${diff.toFixed(2)} — Posting Blocked`,
      description: `HARD STOP: QB Trial Balance differs from ERP by $${diff.toFixed(2)}. QB=${qbTrialBalance.toFixed(2)}, ERP=${erpTrialBalance.toFixed(2)}.\n\nAccount-level diffs:\n${detailLines || "No per-account breakdown available."}\n\nAll accounting posts are BLOCKED until this is resolved.`,
      severity: "critical",
      category: "accounting",
      entity_type: "qb_sync",
    });
  }

  // 6. Run incremental sync to repair any missed updates
  const incrementalResult = await handleIncremental(svc, companyId);

  const duration = Date.now() - t0;
  await logSync(svc, companyId, "ALL", "reconcile", incrementalResult.synced, errors.length, errors, duration, diff);

  return {
    trial_balance_diff: diff,
    is_balanced: isBalanced,
    qb: qbTrialBalance,
    erp: erpTrialBalance,
    ar_diff: arDiff,
    ap_diff: apDiff,
    account_details: accountDetails,
    incremental: incrementalResult,
    errors,
    duration_ms: duration,
  };
}

// ─── SYNC SINGLE ENTITY ────────────────────────────────────────────

async function handleSyncEntity(svc: SvcClient, companyId: string, entityType: string) {
  const t0 = Date.now();
  if (!entityType) throw new Error("entity_type is required");

  const conn = await getCompanyQBConfig(svc, companyId);
  if (!conn) throw new Error("QuickBooks not connected for this company");

  const { config, ctx } = conn;
  const realmId = config.realm_id;
  const errors: string[] = [];

  // Query all records for this entity type from QB
  const txns = await qbQuery(config, ctx, entityType) as Record<string, unknown>[];
  const synced = await upsertTransactions(svc, companyId, realmId, entityType, txns);

  // Normalize to GL
  const accountLookup = await buildLookupMap(svc, "qb_accounts", companyId);
  const customerLookup = await buildLookupMap(svc, "qb_customers", companyId);
  const vendorLookup = await buildLookupMap(svc, "qb_vendors", companyId);

  for (const t of txns) {
    try {
      const { data: row } = await svc
        .from("qb_transactions")
        .select("id")
        .eq("company_id", companyId)
        .eq("qb_id", String(t.Id))
        .eq("entity_type", entityType)
        .maybeSingle();
      if (row) {
        await normalizeToGL(svc, companyId, entityType, row.id, t, accountLookup, customerLookup, vendorLookup);
      }
    } catch (e) { errors.push(`GL ${t.Id}: ${e}`); }
  }

  const duration = Date.now() - t0;
  await logSync(svc, companyId, entityType, "sync-entity", synced, errors.length, errors, duration);

  return { entity_type: entityType, synced, errors, duration_ms: duration };
}

// ─── Report Row Helpers ────────────────────────────────────────────

/** Recursively count leaf data rows (rows with ColData, not section headers) */
function countReportDataRows(rows: unknown[]): number {
  let count = 0;
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const nestedRows = (r?.Rows as Record<string, unknown>)?.Row as unknown[] | undefined;
    if (nestedRows && Array.isArray(nestedRows)) {
      count += countReportDataRows(nestedRows);
    } else if (r?.ColData) {
      count += 1;
    }
  }
  return count;
}

/** Recursively extract the maximum date string from all leaf rows */
function extractMaxDateFromReport(rows: unknown[]): string | null {
  let maxDate = "";
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const nestedRows = (r?.Rows as Record<string, unknown>)?.Row as unknown[] | undefined;
    if (nestedRows && Array.isArray(nestedRows)) {
      const nested = extractMaxDateFromReport(nestedRows);
      if (nested && nested > maxDate) maxDate = nested;
    } else if (r?.ColData) {
      const cols = r.ColData as Array<{ value?: string }>;
      if (cols[0]?.value && cols[0].value > maxDate) {
        maxDate = cols[0].value;
      }
    }
  }
  return maxDate || null;
}

/**
 * Parse a TransactionList report (with `account` column) into a Map<accountName, count>.
 */
function groupReportCountByAccount(report: Record<string, unknown>): Map<string, number> {
  const result = new Map<string, number>();
  const columns = report?.Columns as Record<string, unknown> | undefined;
  const colDefs = (columns?.Column as Array<{ ColTitle?: string }>) || [];
  const accountColIdx = colDefs.findIndex(c => c.ColTitle === "Account");

  function walk(rows: unknown[]) {
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const nestedRows = (r?.Rows as Record<string, unknown>)?.Row as unknown[] | undefined;
      if (nestedRows && Array.isArray(nestedRows)) {
        walk(nestedRows);
      } else if (r?.ColData) {
        const cols = r.ColData as Array<{ value?: string }>;
        const acctName = accountColIdx >= 0 ? cols[accountColIdx]?.value : undefined;
        if (acctName) {
          result.set(acctName, (result.get(acctName) || 0) + 1);
        }
      }
    }
  }

  const reportRows = report?.Rows as Record<string, unknown> | undefined;
  const rows = (reportRows?.Row as unknown[]) || [];
  walk(rows);
  return result;
}

/**
 * Parse a TransactionList report (with `account` and `tx_date` columns)
 * into a Map<accountName, latestDate>.
 */
function groupReportMaxDateByAccount(report: Record<string, unknown>): Map<string, string> {
  const result = new Map<string, string>();
  const columns = report?.Columns as Record<string, unknown> | undefined;
  const colDefs = (columns?.Column as Array<{ ColTitle?: string }>) || [];
  const accountColIdx = colDefs.findIndex(c => c.ColTitle === "Account");
  const dateColIdx = colDefs.findIndex(c => c.ColTitle === "Date");

  function walk(rows: unknown[]) {
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const nestedRows = (r?.Rows as Record<string, unknown>)?.Row as unknown[] | undefined;
      if (nestedRows && Array.isArray(nestedRows)) {
        walk(nestedRows);
      } else if (r?.ColData) {
        const cols = r.ColData as Array<{ value?: string }>;
        const acctName = accountColIdx >= 0 ? cols[accountColIdx]?.value : undefined;
        const dateVal = dateColIdx >= 0 ? cols[dateColIdx]?.value : undefined;
        if (acctName && dateVal) {
          const existing = result.get(acctName);
          if (!existing || dateVal > existing) {
            result.set(acctName, dateVal);
          }
        }
      }
    }
  }

  const reportRows = report?.Rows as Record<string, unknown> | undefined;
  const rows = (reportRows?.Row as unknown[]) || [];
  walk(rows);
  return result;
}

// ─── Sync Bank Activity ────────────────────────────────────────────

async function handleSyncBankActivity(svc: SvcClient, companyId: string) {
  const t0 = Date.now();
  const conn = await getCompanyQBConfig(svc, companyId);
  if (!conn) throw new Error("QuickBooks not connected for this company");

  const { config, ctx } = conn;
  const errors: string[] = [];

  // Get all active Bank-type accounts from qb_accounts
  const { data: bankAccounts } = await svc
    .from("qb_accounts")
    .select("qb_id, name, current_balance")
    .eq("company_id", companyId)
    .eq("account_type", "Bank")
    .eq("is_active", true);

  if (!bankAccounts || bankAccounts.length === 0) {
    return { synced: 0, message: "No bank accounts found" };
  }

  let synced = 0;

  // Fix 1: Fetch ALL bank account balances in one Query API call (Account/{id} returns 400)
  const balanceMap = new Map<string, number>();
  try {
    const queryResult = await qbFetch(
      config,
      `query?query=${encodeURIComponent("SELECT Id, Name, CurrentBalance FROM Account WHERE AccountType = 'Bank' AND Active = true")}`,
      ctx,
    ) as Record<string, unknown>;
    const queryResponse = queryResult?.QueryResponse as Record<string, unknown> | undefined;
    const accounts = (queryResponse?.Account as Array<Record<string, unknown>>) || [];
    for (const acct of accounts) {
      if (acct.Id && acct.CurrentBalance != null) {
        balanceMap.set(String(acct.Id), acct.CurrentBalance as number);
      }
    }
    console.log(`[sync-bank-activity] Fetched live balances for ${balanceMap.size} bank accounts via Query API`);
  } catch (e) {
    console.warn(`[sync-bank-activity] Query API balance fetch failed, will use cached balances:`, e);
  }

  // Fetch TWO bulk reports ONCE (with account column) then group in code
  const unclearedByAccount = new Map<string, number>();
  const reconDateByAccount = new Map<string, string>();

  try {
    const unclearedReport = await qbFetch(
      config,
      `reports/TransactionList?cleared=Uncleared&columns=tx_date,txn_type,account,subt_nat_amount`,
      ctx,
    ) as Record<string, unknown>;
    const grouped = groupReportCountByAccount(unclearedReport);
    for (const [k, v] of grouped) unclearedByAccount.set(k, v);
    console.log(`[sync-bank-activity] Bulk uncleared report: ${unclearedByAccount.size} accounts, entries: ${JSON.stringify([...unclearedByAccount])}`);
  } catch (e) {
    console.warn(`[sync-bank-activity] Bulk uncleared report failed:`, e);
  }

  try {
    const reconReport = await qbFetch(
      config,
      `reports/TransactionList?cleared=Reconciled&columns=tx_date,account`,
      ctx,
    ) as Record<string, unknown>;
    const grouped = groupReportMaxDateByAccount(reconReport);
    for (const [k, v] of grouped) reconDateByAccount.set(k, v);
    console.log(`[sync-bank-activity] Bulk reconciled report: ${reconDateByAccount.size} accounts, dates: ${JSON.stringify([...reconDateByAccount])}`);
  } catch (e) {
    console.warn(`[sync-bank-activity] Bulk reconciled report failed:`, e);
  }

  for (const account of bankAccounts) {
    try {
      // Use live balance from Query API, fallback to cached
      const liveLedgerBalance = balanceMap.get(account.qb_id) ?? account.current_balance;

      // Look up from pre-fetched bulk maps by account name
      const unreconciledCount = unclearedByAccount.get(account.name) || 0;
      const reconciledThroughDate = reconDateByAccount.get(account.name) || null;

      // Upsert into qb_bank_activity, preserving manual bank_balance
      const { data: existing } = await svc
        .from("qb_bank_activity")
        .select("bank_balance")
        .eq("company_id", companyId)
        .eq("qb_account_id", account.qb_id)
        .maybeSingle();

      const upsertRow: Record<string, unknown> = {
        company_id: companyId,
        qb_account_id: account.qb_id,
        account_name: account.name,
        ledger_balance: liveLedgerBalance,
        unreconciled_count: unreconciledCount,
        unaccepted_count: 0,
        reconciled_through_date: reconciledThroughDate,
        last_qb_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Preserve existing bank_balance if present
      if (existing?.bank_balance != null) {
        upsertRow.bank_balance = existing.bank_balance;
      }

      const { error } = await svc
        .from("qb_bank_activity")
        .upsert(upsertRow, { onConflict: "company_id,qb_account_id" });

      if (error) {
        errors.push(`${account.name}: ${error.message}`);
      } else {
        synced++;
      }
    } catch (e) {
      errors.push(`${account.name}: ${e}`);
    }
  }

  const duration = Date.now() - t0;
  await logSync(svc, companyId, "bank_activity", "sync-bank-activity", synced, errors.length, errors, duration);

  return { synced, errors, duration_ms: duration, total_accounts: bankAccounts.length };
}

// ─── Main Handler ──────────────────────────────────────────────────

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const svcUrl = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(svcUrl, svcKey);

    // Auth: accept service role key, cron secret, OR authenticated user
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const cronSecret = req.headers.get("x-cron-secret") || "";

    let companyId: string | null = null;
    const mcpKey = Deno.env.get("MCP_API_KEY") || "";

    if (token === svcKey) {
      // Service role — get company_id from body
    } else if (cronSecret && mcpKey && cronSecret === mcpKey) {
      // Cron job auth via shared secret — get company_id from body
    } else {
      // User auth
      const anonClient = createClient(svcUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(token);
      if (claimsErr || !claims?.claims?.sub) {
        return jsonRes({ error: "Unauthorized" }, 401);
      }
      const userId = claims.claims.sub as string;
      const { data: profile } = await svc.from("profiles").select("company_id").eq("user_id", userId).maybeSingle();
      if (!profile?.company_id) return jsonRes({ error: "No company" }, 403);
      companyId = profile.company_id;
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    companyId = companyId || body.company_id;

    if (!companyId) return jsonRes({ error: "company_id required" }, 400);
    if (!action) return jsonRes({ error: "action required" }, 400);

    // --- Single-flight lock: prevent concurrent runs for same company+action ---
    // Clean up expired locks first
    try {
      await svc.from("qb_sync_locks").delete().lt("expires_at", new Date().toISOString());
    } catch (_) { /* best effort */ }

    const lockKey = { company_id: companyId, action };
    const { error: lockErr } = await svc.from("qb_sync_locks").insert({
      ...lockKey,
      locked_by: `qb-sync-engine-${crypto.randomUUID().slice(0, 8)}`,
      locked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });

    if (lockErr) {
      // Unique constraint violation = already locked
      if (lockErr.code === "23505" || lockErr.message?.includes("duplicate key")) {
        console.warn(`[qb-sync-engine] Already locked: ${companyId}/${action}`);
        return jsonRes({ error: "Sync already in progress for this company", locked: true }, 409);
      }
      console.error("[qb-sync-engine] Lock acquisition failed:", lockErr.message);
    }

    try {
      let result: unknown;
      switch (action) {
        case "backfill":
          result = await handleBackfill(svc, companyId);
          break;
        case "incremental":
          result = await handleIncremental(svc, companyId);
          break;
        case "reconcile":
          result = await handleReconcile(svc, companyId);
          break;
        case "sync-entity":
          result = await handleSyncEntity(svc, companyId, body.entity_type);
          break;
        case "sync-bank-activity":
          result = await handleSyncBankActivity(svc, companyId);
          break;
        default:
          // Release lock before returning error
          await svc.from("qb_sync_locks").delete().match(lockKey);
          return jsonRes({ error: `Unknown action: ${action}` }, 400);
      }
      return jsonRes(result);
    } finally {
      // Always release lock
      try {
        await svc.from("qb_sync_locks").delete().match(lockKey);
      } catch (e) {
        console.error("[qb-sync-engine] Lock release failed:", e);
      }
    }
  } catch (error) {
    console.error("qb-sync-engine error:", error);
    return jsonRes({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
