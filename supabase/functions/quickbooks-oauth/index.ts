import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QUICKBOOKS_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
// Use sandbox until QB app is approved for production
const QUICKBOOKS_API_BASE = Deno.env.get("QUICKBOOKS_ENVIRONMENT") === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com";

// ─── Helpers ───────────────────────────────────────────────────────

async function verifyAuth(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}

async function getUserCompanyId(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.company_id) throw new Error("User has no company assigned");
  return profile.company_id;
}

// Company-wide QB connection: find ANY connected QB row for the user's company
async function getUserQBConnection(supabase: ReturnType<typeof createClient>, userId: string) {
  const companyId = await getUserCompanyId(supabase, userId);

  // First try to find a connection that has company_id in its config
  const { data: connections } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("integration_id", "quickbooks")
    .eq("status", "connected");

  if (!connections || connections.length === 0) return null;

  // Find connection belonging to any user in the same company
  for (const conn of connections) {
    const config = conn.config as Record<string, unknown> | null;
    // Check if connection has company_id stored in config
    if (config?.company_id === companyId) return conn;
  }

  // Fallback: check if the connection owner belongs to the same company
  for (const conn of connections) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", conn.user_id)
      .maybeSingle();
    if (ownerProfile?.company_id === companyId) return conn;
  }

  return null;
}

type QBConfig = { realm_id: string; access_token: string; refresh_token: string; expires_at: number; company_id?: string };
type QBConfigWithContext = QBConfig & { _refreshContext: { supabase: ReturnType<typeof createClient>; connectionId: string } };

async function getQBConfig(supabase: ReturnType<typeof createClient>, userId: string): Promise<QBConfigWithContext> {
  const connection = await getUserQBConnection(supabase, userId);
  if (!connection) throw new Error("QuickBooks not connected");
  const config = connection.config as QBConfig;
  return { ...config, _refreshContext: { supabase, connectionId: connection.id } };
}

// Shared token refresh to avoid concurrent refreshes
let _refreshPromise: Promise<string> | null = null;

async function refreshQBToken(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  config: { realm_id: string; access_token: string; refresh_token: string; expires_at: number; company_id?: string },
): Promise<string> {
  const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID")!;
  const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET")!;

  const refreshResponse = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refresh_token,
    }),
  });

  const newTokens = await refreshResponse.json();
  if (!refreshResponse.ok) {
    console.error("QB token refresh failed:", JSON.stringify(newTokens));
    throw new Error("QuickBooks token refresh failed — please reconnect");
  }

  const newAccessToken = newTokens.access_token;
  // Persist refreshed tokens
  await supabase
    .from("integration_connections")
    .update({
      config: {
        ...config,
        access_token: newAccessToken,
        refresh_token: newTokens.refresh_token,
        expires_at: Date.now() + (newTokens.expires_in * 1000),
      },
      last_sync_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  // Update in-memory config so subsequent calls in the same request use the new token
  config.access_token = newAccessToken;
  if (newTokens.refresh_token) config.refresh_token = newTokens.refresh_token;
  config.expires_at = Date.now() + (newTokens.expires_in * 1000);

  return newAccessToken;
}

async function qbFetch(
  config: { realm_id: string; access_token: string; refresh_token?: string; expires_at?: number; company_id?: string; _refreshContext?: { supabase: ReturnType<typeof createClient>; connectionId: string } },
  path: string,
  options?: RequestInit,
  _retries = 0,
  _refreshContextOverride?: { supabase: ReturnType<typeof createClient>; connectionId: string },
): Promise<unknown> {
  const _refreshContext = _refreshContextOverride || (config as QBConfigWithContext)._refreshContext;
  const MAX_RETRIES = 4;

  // Proactive token refresh: if token expires within 5 minutes, refresh before making the call
  if (config.expires_at && config.refresh_token && _refreshContext && config.expires_at < Date.now() + 300_000) {
    console.log(`[QB] Proactive token refresh — expires in ${Math.round((config.expires_at - Date.now()) / 1000)}s`);
    try {
      if (!_refreshPromise) {
        _refreshPromise = refreshQBToken(
          _refreshContext.supabase,
          _refreshContext.connectionId,
          config as { realm_id: string; access_token: string; refresh_token: string; expires_at: number; company_id?: string },
        );
      }
      await _refreshPromise;
      _refreshPromise = null;
    } catch (err) {
      _refreshPromise = null;
      console.warn("[QB] Proactive refresh failed, proceeding with current token:", err);
    }
  }

  const url = `${QUICKBOOKS_API_BASE}/v3/company/${config.realm_id}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${config.access_token}`,
      "Accept": "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });

  // Retry on 429 (rate limit) with exponential backoff
  if (res.status === 429 && _retries < MAX_RETRIES) {
    const delay = Math.min(1000 * Math.pow(2, _retries), 10000);
    console.warn(`QB rate-limited on [${path}], retry ${_retries + 1}/${MAX_RETRIES} in ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
    return qbFetch(config, path, options, _retries + 1, _refreshContext);
  }

  // Auto-refresh on 401 (expired token) — only retry once
  if (res.status === 401 && _retries === 0 && _refreshContext && config.refresh_token) {
    console.warn(`QB 401 on [${path}], refreshing token...`);
    await res.text();
    try {
      if (!_refreshPromise) {
        _refreshPromise = refreshQBToken(
          _refreshContext.supabase,
          _refreshContext.connectionId,
          config as { realm_id: string; access_token: string; refresh_token: string; expires_at: number; company_id?: string },
        );
      }
      await _refreshPromise;
      _refreshPromise = null;
      return qbFetch(config, path, options, 1, _refreshContext);
    } catch (refreshErr) {
      _refreshPromise = null;
      console.error("QB token refresh failed during fetch:", refreshErr);
      throw refreshErr;
    }
  }

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`QB API error [${path}]:`, errorText);
    throw new Error(`QuickBooks API error (${res.status}): ${path}`);
  }
  return res.json();
}

async function qbQuery(config: QBConfigWithContext | { realm_id: string; access_token: string }, entity: string, maxResults = 50000, whereClause?: string) {
  const allResults: unknown[] = [];
  let startPosition = 1;
  const pageSize = Math.min(maxResults, 1000);
  const where = whereClause ? ` WHERE ${whereClause}` : "";
  const refreshCtx = (config as QBConfigWithContext)._refreshContext;

  while (true) {
    const data = await qbFetch(
      config,
      `query?query=SELECT * FROM ${entity}${where} STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`,
      undefined,
      0,
      refreshCtx,
    ) as Record<string, unknown>;
    const response = data.QueryResponse as Record<string, unknown> | undefined;
    const entities = (response?.[entity] as unknown[]) || [];
    allResults.push(...entities);

    if (entities.length < pageSize || allResults.length >= maxResults) break;
    startPosition += pageSize;
  }

  return { QueryResponse: { [entity]: allResults } };
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function updateLastSync(supabase: ReturnType<typeof createClient>, userId: string) {
  // Update the company-wide connection's last_sync_at
  const connection = await getUserQBConnection(supabase, userId);
  if (connection) {
    return supabase
      .from("integration_connections")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", connection.id);
  }
}

// ─── Main Handler ──────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID");
    const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("QuickBooks credentials not configured");
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const pathAction = pathParts[pathParts.length - 1];

    // ─── OAuth Callback (no auth header) ─────────────────────────
    if (pathAction === "callback") {
      return handleCallback(url, supabase, supabaseUrl, clientId, clientSecret);
    }

    // ─── All other actions require authentication ────────────────
    const userId = await verifyAuth(req);
    if (!userId) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ─── Route to action handler ─────────────────────────────────
    switch (action) {
      case "get-auth-url":
        return handleGetAuthUrl(supabaseUrl, clientId, userId, body);
      case "check-status":
        return handleCheckStatus(supabase, userId, clientId, clientSecret);
      case "disconnect":
        return handleDisconnect(supabase, userId);

      // ── Read / Sync ────────────────────────────────────────────
      case "sync-customers":
        return handleSyncCustomers(supabase, userId);
      case "sync-invoices":
        return handleSyncInvoices(supabase, userId);
      case "sync-vendors":
        return handleSyncVendors(supabase, userId);
      case "get-company-info":
        return handleGetCompanyInfo(supabase, userId);
      case "dashboard-summary":
        return handleDashboardSummary(supabase, userId);
      case "list-accounts":
        return handleListAccounts(supabase, userId);
      case "list-bank-accounts":
        return handleListBankAccounts(supabase, userId);
      case "list-items":
        return handleListItems(supabase, userId);
      case "list-invoices":
        return handleListInvoices(supabase, userId);
      case "list-estimates":
        return handleListEstimates(supabase, userId);
      case "list-bills":
        return handleListBills(supabase, userId);
      case "list-payments":
        return handleListPayments(supabase, userId);
      case "list-purchase-orders":
        return handleListPurchaseOrders(supabase, userId);
      case "list-credit-memos":
        return handleListCreditMemos(supabase, userId);
      case "list-vendors":
        return handleListVendors(supabase, userId);
      case "get-profit-loss":
        return handleGetProfitLoss(supabase, userId, body);
      case "get-balance-sheet":
        return handleGetBalanceSheet(supabase, userId, body);

      // ── Write / Create ─────────────────────────────────────────
      case "create-estimate":
        return handleCreateEstimate(supabase, userId, body);
      case "create-invoice":
        return handleCreateInvoice(supabase, userId, body);
      case "create-payment":
        return handleCreatePayment(supabase, userId, body);
      case "create-bill":
        return handleCreateBill(supabase, userId, body);
      case "create-credit-memo":
        return handleCreateCreditMemo(supabase, userId, body);
      case "create-purchase-order":
        return handleCreatePurchaseOrder(supabase, userId, body);
      case "create-vendor":
        return handleCreateVendor(supabase, userId, body);
      case "create-account":
        return handleCreateAccount(supabase, userId, body);
      case "delete-transaction":
        return handleDeleteTransaction(supabase, userId, body);
      case "void-transaction":
        return handleVoidTransaction(supabase, userId, body);
      case "create-item":
        return handleCreateItem(supabase, userId, body);
      case "convert-estimate-to-invoice":
        return handleConvertEstimateToInvoice(supabase, userId, body);
      case "send-invoice":
        return handleSendInvoice(supabase, userId, body);
      case "void-invoice":
        return handleVoidInvoice(supabase, userId, body);
      case "update-invoice":
        return handleUpdateInvoice(supabase, userId, body);

      // ── Payroll ────────────────────────────────────────────────
      case "list-employees":
        return handleListEmployees(supabase, userId);
      case "get-employee":
        return handleGetEmployee(supabase, userId, body);
      case "update-employee":
        return handleUpdateEmployee(supabase, userId, body);
      case "list-time-activities":
        return handleListTimeActivities(supabase, userId);
      case "create-payroll-correction":
        return handleCreatePayrollCorrection(supabase, userId, body);

      // ── Reports ────────────────────────────────────────────────
      case "account-quick-report":
        return handleAccountQuickReport(supabase, userId, body);

      // ── Phase 1: New Transaction Types ─────────────────────────
      case "list-sales-receipts":
        return handleListSalesReceipts(supabase, userId);
      case "create-sales-receipt":
        return handleCreateSalesReceipt(supabase, userId, body);
      case "list-refund-receipts":
        return handleListRefundReceipts(supabase, userId);
      case "create-refund-receipt":
        return handleCreateRefundReceipt(supabase, userId, body);
      case "list-deposits":
        return handleListDeposits(supabase, userId);
      case "create-deposit":
        return handleCreateDeposit(supabase, userId, body);
      case "create-transfer":
        return handleCreateTransfer(supabase, userId, body);
      case "list-journal-entries":
        return handleListJournalEntries(supabase, userId);
      case "create-journal-entry":
        return handleCreateJournalEntry(supabase, userId, body);

      // ── Phase 1: New Reports ───────────────────────────────────
      case "get-aged-receivables":
        return handleGetAgedReceivables(supabase, userId, body);
      case "get-aged-payables":
        return handleGetAgedPayables(supabase, userId, body);
      case "get-general-ledger":
        return handleGetGeneralLedger(supabase, userId, body);
      case "get-trial-balance":
        return handleGetTrialBalance(supabase, userId, body);
      case "get-transaction-list":
        return handleGetTransactionList(supabase, userId, body);

      // ── Phase 17: New Actions ─────────────────────────────────
      case "get-cash-flow":
        return handleGetCashFlow(supabase, userId, body);
      case "get-tax-summary":
        return handleGetTaxSummary(supabase, userId, body);
      case "create-bill-payment":
        return handleCreateBillPayment(supabase, userId, body);
      case "list-bill-payments":
        return handleListBillPayments(supabase, userId);
      case "update-customer":
        return handleUpdateCustomer(supabase, userId, body);
      case "update-vendor":
        return handleUpdateVendor(supabase, userId, body);
      case "list-classes":
        return handleListClasses(supabase, userId);
      case "list-departments":
        return handleListDepartments(supabase, userId);
      case "create-class":
        return handleCreateClass(supabase, userId, body);
      case "create-purchase":
        return handleCreatePurchase(supabase, userId, body);
      case "upload-attachment":
        return handleUploadAttachment(supabase, userId, body);
      case "list-attachments":
        return handleListAttachments(supabase, userId, body);

      // ── Sync Engine Delegation ─────────────────────────────────
      case "full-sync":
      case "incremental-sync":
      case "reconcile": {
        const companyId = await getUserCompanyId(supabase, userId);
        const syncAction = action === "full-sync" ? "backfill" : action === "incremental-sync" ? "incremental" : "reconcile";
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const syncRes = await fetch(`${supabaseUrl}/functions/v1/qb-sync-engine`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${svcKey}` },
          body: JSON.stringify({ action: syncAction, company_id: companyId }),
        });
        const syncData = await syncRes.json();
        return jsonRes(syncData, syncRes.status);
      }

      default:
        return jsonRes({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    console.error("QuickBooks OAuth error:", error);
    return jsonRes(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});

// ─── OAuth Callback ────────────────────────────────────────────────

async function handleCallback(
  url: URL,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  clientId: string,
  clientSecret: string
) {
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("OAuth error:", error);
    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'oauth-error',error:'${error}'},'*');window.close();</script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code || !realmId) throw new Error("Missing code or realmId in callback");

  let userId = "";
  let returnUrl = "";
  if (state) {
    const parts = state.split("|");
    userId = parts[0] || "";
    returnUrl = parts.slice(1).join("|") || "";
  }

  if (!userId) throw new Error("Missing user context in OAuth callback");

  // Get user's company_id for company-wide storage
  const companyId = await getUserCompanyId(supabase, userId);

  const tokenResponse = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Accept": "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${supabaseUrl}/functions/v1/quickbooks-oauth/callback`,
    }),
  });

  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok) {
    console.error("Token exchange failed:", tokens);
    throw new Error(tokens.error_description || "Token exchange failed");
  }

  // Delete any existing QB connections for users in the same company (cleanup duplicates)
  const { data: allQBConnections } = await supabase
    .from("integration_connections")
    .select("id, user_id")
    .eq("integration_id", "quickbooks");

  if (allQBConnections) {
    for (const conn of allQBConnections) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", conn.user_id)
        .maybeSingle();
      if (profile?.company_id === companyId) {
        await supabase.from("integration_connections").delete().eq("id", conn.id);
      }
    }
  }

  // Store the new company-wide connection under the connecting user
  const { error: dbError } = await supabase
    .from("integration_connections")
    .upsert({
      user_id: userId,
      integration_id: "quickbooks",
      status: "connected",
      config: {
        realm_id: realmId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in * 1000),
        refresh_token_expires_at: Date.now() + (tokens.x_refresh_token_expires_in * 1000),
        company_id: companyId,
      },
      last_sync_at: new Date().toISOString(),
      error_message: null,
    }, { onConflict: "user_id,integration_id" });

  if (dbError) {
    console.error("Failed to store tokens:", dbError);
    throw new Error("Failed to store tokens");
  }

  const redirectTarget = returnUrl || `${url.origin}/integrations`;
  return new Response(null, {
    status: 302,
    headers: { Location: redirectTarget.replace("preview--", "") },
  });
}

// ─── Auth URL ──────────────────────────────────────────────────────

function handleGetAuthUrl(supabaseUrl: string, clientId: string, userId: string, body: Record<string, unknown>) {
  const redirectUri = `${supabaseUrl}/functions/v1/quickbooks-oauth/callback`;
  // Payroll scope requires separate Intuit approval for production apps;
  // only include it when explicitly requested to avoid invalid_scope errors.
  const includePayroll = body.includePayroll === true;
  const scope = includePayroll
    ? "com.intuit.quickbooks.accounting com.intuit.quickbooks.payroll"
    : "com.intuit.quickbooks.accounting";
  const state = `${userId}|${body.returnUrl || ""}`;

  const authUrl = new URL(QUICKBOOKS_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);

  return jsonRes({ authUrl: authUrl.toString() });
}

// ─── Check Status ──────────────────────────────────────────────────

async function handleCheckStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  clientId: string,
  clientSecret: string
) {
  const connection = await getUserQBConnection(supabase, userId);

  if (!connection) {
    return jsonRes({ status: "available" });
  }

  const config = connection.config as {
    realm_id: string; access_token: string;
    refresh_token: string; expires_at: number;
    company_id?: string;
  };

  if (config.expires_at < Date.now()) {
    try {
      const refreshResponse = await fetch(QUICKBOOKS_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: config.refresh_token,
        }),
      });

      const newTokens = await refreshResponse.json();

      if (refreshResponse.ok) {
        await supabase
          .from("integration_connections")
          .update({
            config: {
              ...config,
              access_token: newTokens.access_token,
              refresh_token: newTokens.refresh_token,
              expires_at: Date.now() + (newTokens.expires_in * 1000),
            },
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
      } else {
        throw new Error("Token refresh failed");
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
      // Check if this is a transient failure — don't immediately mark as error
      // QB refresh tokens last 100 days; only mark error if truly unrecoverable
      const config2 = connection.config as Record<string, unknown>;
      const refreshTokenExpiresAt = config2.refresh_token_expires_at as number | undefined;
      const isRefreshTokenExpired = refreshTokenExpiresAt && refreshTokenExpiresAt < Date.now();

      if (isRefreshTokenExpired) {
        await supabase
          .from("integration_connections")
          .update({ status: "error", error_message: "Refresh token expired, please reconnect" })
          .eq("id", connection.id);
        return jsonRes({ status: "error", error: "Token expired, please reconnect" });
      }

      // Transient failure — keep connected status, return retry hint
      console.warn("[QB] Transient refresh failure, keeping connected status");
      return jsonRes({ status: "connected", warning: "token_refresh_retry", realmId: config.realm_id });
    }
  }

  return jsonRes({ status: "connected", realmId: config.realm_id });
}

// ─── Disconnect ────────────────────────────────────────────────────

async function handleDisconnect(supabase: ReturnType<typeof createClient>, userId: string) {
  // Delete the company-wide QB connection
  const connection = await getUserQBConnection(supabase, userId);
  if (connection) {
    await supabase.from("integration_connections").delete().eq("id", connection.id);
  }

  return jsonRes({ success: true });
}

// ─── Get Company Info ──────────────────────────────────────────────

async function handleGetCompanyInfo(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbFetch(config, `companyinfo/${config.realm_id}`, undefined, 0, config._refreshContext) as Record<string, unknown>;
  return jsonRes(data.CompanyInfo);
}

// ─── Sync Customers ───────────────────────────────────────────────

async function handleSyncCustomers(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const companyId = await getUserCompanyId(supabase, userId);

  const qbData = await qbQuery(config, "Customer");
  const customers = qbData.QueryResponse?.Customer || [];

  let synced = 0;
  const errors: string[] = [];
  // Batch upsert customers in chunks of 50 to avoid timeouts
  const BATCH_SIZE = 50;
  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);
    const records = batch.map((customer: Record<string, unknown>) => ({
      quickbooks_id: customer.Id as string,
      name: (customer.DisplayName as string) || "Unknown",
      company_name: (customer.CompanyName as string) || null,
      company_id: companyId,
      notes: (customer.Notes as string) || null,
      credit_limit: (customer.CreditLimit as number) || null,
      payment_terms: (customer.SalesTermRef as Record<string, unknown>)?.name as string || null,
      status: customer.Active ? "active" : "inactive",
    }));

    const { error, count } = await supabase
      .from("customers")
      .upsert(records, { onConflict: "quickbooks_id", count: "exact" });

    if (!error) synced += (count || batch.length);
    else errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
  }

  if (errors.length > 0) console.error("Customer sync errors:", errors.slice(0, 5));

  // ── Name-matching phase: link unlinked local customers to QB by name ──
  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");

  // Build lookup map from QB DisplayName/CompanyName → QB Id
  const nameToQbId = new Map<string, string>();
  // Also keep a list of QB names sorted longest-first for prefix matching
  const qbNames: string[] = [];
  for (const c of customers) {
    const qbId = c.Id as string;
    if (c.DisplayName) {
      const n = normalize(c.DisplayName as string);
      nameToQbId.set(n, qbId);
      qbNames.push(n);
    }
    if (c.CompanyName) {
      const n = normalize(c.CompanyName as string);
      nameToQbId.set(n, qbId);
      qbNames.push(n);
    }
  }
  // Sort longest first so we match the most specific prefix
  qbNames.sort((a, b) => b.length - a.length);

  // Build set of QB IDs already linked to prevent duplicate assignments
  const linkedQbIds = new Set<string>();
  let linkedPage = 0;
  while (true) {
    const { data: linked } = await supabase
      .from("customers")
      .select("quickbooks_id")
      .not("quickbooks_id", "is", null)
      .eq("company_id", companyId)
      .range(linkedPage * PAGE, (linkedPage + 1) * PAGE - 1);
    const lr = linked || [];
    for (const r of lr) if (r.quickbooks_id) linkedQbIds.add(r.quickbooks_id);
    if (lr.length < PAGE) break;
    linkedPage++;
  }

  // Also track names of linked customers for duplicate detection
  const linkedNames = new Set<string>();
  let lnPage = 0;
  while (true) {
    const { data: ln } = await supabase
      .from("customers")
      .select("name")
      .not("quickbooks_id", "is", null)
      .eq("company_id", companyId)
      .range(lnPage * PAGE, (lnPage + 1) * PAGE - 1);
    const lr = ln || [];
    for (const r of lr) if (r.name) linkedNames.add(normalize(r.name));
    if (lr.length < PAGE) break;
    lnPage++;
  }

  // Fetch all local customers without a quickbooks_id
  let matched = 0;
  let duplicatesSkipped = 0;
  let page = 0;
  while (true) {
    const { data: unlinked } = await supabase
      .from("customers")
      .select("id, name")
      .is("quickbooks_id", null)
      .eq("company_id", companyId)
      .range(page * PAGE, (page + 1) * PAGE - 1);
    const rows = unlinked || [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const key = normalize(row.name || "");
      if (!key) continue;

      // Check if this is a duplicate of an already-linked customer
      if (linkedNames.has(key)) {
        duplicatesSkipped++;
        continue;
      }

      // 1. Exact match
      let qbId = nameToQbId.get(key);

      // 2. Prefix match: check if any QB name is a prefix of the local name
      if (!qbId) {
        for (const qbName of qbNames) {
          if (key.startsWith(qbName) && key.length > qbName.length) {
            qbId = nameToQbId.get(qbName);
            break;
          }
        }
      }

      // 3. Guard: skip if this QB ID is already linked to another local customer
      if (qbId && linkedQbIds.has(qbId)) {
        duplicatesSkipped++;
        continue;
      }

      if (qbId) {
        const { error: linkErr } = await supabase
          .from("customers")
          .update({ quickbooks_id: qbId })
          .eq("id", row.id);
        if (!linkErr) {
          matched++;
          linkedQbIds.add(qbId); // prevent further duplicates in this run
        }
      }
    }
    if (rows.length < PAGE) break;
    page++;
  }

  if (matched > 0 || duplicatesSkipped > 0) {
    console.log(`Auto-match: ${matched} linked, ${duplicatesSkipped} duplicates/already-linked skipped`);
  }
  await updateLastSync(supabase, userId);

  return jsonRes({ success: true, synced, matched, duplicatesSkipped, total: customers.length, errors: errors.length });
}

// ─── Sync Invoices ─────────────────────────────────────────────────

async function handleSyncInvoices(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const companyId = await getUserCompanyId(supabase, userId);

  const qbData = await qbQuery(config, "Invoice");
  const invoices = qbData.QueryResponse?.Invoice || [];

  // Pre-load ALL customer QB-id → local-id mapping (paginate past 1000-row limit)
  const customerMap = new Map<string, string>();
  let customerPage = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data: batch } = await supabase
      .from("customers")
      .select("id, quickbooks_id")
      .not("quickbooks_id", "is", null)
      .range(customerPage * PAGE_SIZE, (customerPage + 1) * PAGE_SIZE - 1);
    const rows = batch || [];
    for (const c of rows) {
      if (c.quickbooks_id) customerMap.set(c.quickbooks_id, c.id);
    }
    if (rows.length < PAGE_SIZE) break;
    customerPage++;
  }

  let synced = 0;
  const errors: string[] = [];
  const BATCH_SIZE = 50;
  const now = new Date().toISOString();

  for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
    const batch = invoices.slice(i, i + BATCH_SIZE);
    const records = batch.map((invoice: Record<string, unknown>) => {
      const custRef = invoice.CustomerRef as { value?: string; name?: string } | undefined;
      const customerId = custRef?.value ? (customerMap.get(custRef.value) || null) : null;
      return {
        quickbooks_id: invoice.Id as string,
        entity_type: "Invoice",
        balance: (invoice.Balance as number) || 0,
        customer_id: customerId,
        company_id: companyId,
        data: {
          DocNumber: invoice.DocNumber,
          TotalAmt: invoice.TotalAmt,
          DueDate: invoice.DueDate,
          TxnDate: invoice.TxnDate,
          CustomerName: custRef?.name,
          EmailStatus: invoice.EmailStatus,
          Balance: invoice.Balance,
          Line: invoice.Line,
        },
        last_synced_at: now,
      };
    });

    const { error, count } = await supabase
      .from("accounting_mirror")
      .upsert(records, { onConflict: "quickbooks_id", count: "exact" });

    if (!error) synced += (count || batch.length);
    else errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
  }

  if (errors.length > 0) console.error("Invoice sync errors:", errors.slice(0, 5));
  await updateLastSync(supabase, userId);
  return jsonRes({ success: true, synced, total: invoices.length, errors: errors.length });
}

// ─── Sync Vendors ──────────────────────────────────────────────────

async function handleSyncVendors(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const companyId = await getUserCompanyId(supabase, userId);

  const qbData = await qbQuery(config, "Vendor");
  const vendors = qbData.QueryResponse?.Vendor || [];

  let synced = 0;
  for (const vendor of vendors) {
    const { error } = await supabase
      .from("accounting_mirror")
      .upsert({
        quickbooks_id: `vendor_${vendor.Id}`,
        entity_type: "Vendor",
        balance: vendor.Balance || 0,
        company_id: companyId,
        data: {
          DisplayName: vendor.DisplayName,
          CompanyName: vendor.CompanyName,
          PrimaryPhone: vendor.PrimaryPhone?.FreeFormNumber,
          PrimaryEmailAddr: vendor.PrimaryEmailAddr?.Address,
          Active: vendor.Active,
          Balance: vendor.Balance,
          AcctNum: vendor.AcctNum,
          TaxIdentifier: vendor.TaxIdentifier,
        },
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "quickbooks_id" });

    if (!error) synced++;
    else console.error(`Vendor sync error (${vendor.Id}):`, error.message);
  }

  await updateLastSync(supabase, userId);
  return jsonRes({ success: true, synced, total: vendors.length });
}

// ─── Dashboard Summary (single call for dashboard cards) ─────────

async function handleDashboardSummary(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  
  // Fetch all dashboard-critical data in parallel with a single config lookup
  const [invoicesRes, billsRes, paymentsRes, bankRes] = await Promise.all([
    qbQuery(config, "Invoice"),
    qbQuery(config, "Bill"),
    qbQuery(config, "Payment"),
    qbQuery(config, "Account", 500, "AccountType = 'Bank'"),
  ]);

  return jsonRes({
    invoices: invoicesRes.QueryResponse?.Invoice || [],
    bills: billsRes.QueryResponse?.Bill || [],
    payments: paymentsRes.QueryResponse?.Payment || [],
    accounts: bankRes.QueryResponse?.Account || [],
  });
}

// ─── List Entities (direct from QB API) ───────────────────────────

async function handleListAccounts(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Account");
  return jsonRes({ accounts: data.QueryResponse?.Account || [] });
}

async function handleListBankAccounts(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Account", 500, "AccountType = 'Bank'");
  return jsonRes({ accounts: data.QueryResponse?.Account || [] });
}

async function handleListItems(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Item");
  return jsonRes({ items: data.QueryResponse?.Item || [] });
}

async function handleListInvoices(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Invoice");
  return jsonRes({ invoices: data.QueryResponse?.Invoice || [] });
}

async function handleListEstimates(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Estimate");
  return jsonRes({ estimates: data.QueryResponse?.Estimate || [] });
}

async function handleListBills(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Bill");
  return jsonRes({ bills: data.QueryResponse?.Bill || [] });
}

async function handleListPayments(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Payment");
  return jsonRes({ payments: data.QueryResponse?.Payment || [] });
}

async function handleListPurchaseOrders(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "PurchaseOrder");
  return jsonRes({ purchaseOrders: data.QueryResponse?.PurchaseOrder || [] });
}

async function handleListCreditMemos(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "CreditMemo");
  return jsonRes({ creditMemos: data.QueryResponse?.CreditMemo || [] });
}

async function handleListVendors(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Vendor");
  return jsonRes({ vendors: data.QueryResponse?.Vendor || [] });
}

// ─── Reports ──────────────────────────────────────────────────────

async function handleGetProfitLoss(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const startDate = (body.startDate as string) || "2024-01-01";
  const endDate = (body.endDate as string) || new Date().toISOString().split("T")[0];
  const data = await qbFetch(config, `reports/ProfitAndLoss?start_date=${startDate}&end_date=${endDate}`);
  return jsonRes(data);
}

async function handleGetBalanceSheet(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const asOfDate = (body.asOfDate as string) || new Date().toISOString().split("T")[0];
  const data = await qbFetch(config, `reports/BalanceSheet?end_date=${asOfDate}`);
  return jsonRes(data);
}

// ─── Create Estimate ──────────────────────────────────────────────

async function handleCreateEstimate(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { customerId, customerName, lineItems, expirationDate, memo } = body as {
    customerId: string; customerName: string;
    lineItems: { description: string; amount: number; quantity?: number }[];
    expirationDate?: string; memo?: string;
  };

  if (!customerId || !lineItems || (lineItems as unknown[]).length === 0) {
    throw new Error("Customer ID and line items are required");
  }

  const payload = {
    CustomerRef: { value: customerId, name: customerName },
    Line: lineItems.map(item => ({
      DetailType: "SalesItemLineDetail",
      Amount: item.amount * (item.quantity || 1),
      Description: item.description,
      SalesItemLineDetail: { Qty: item.quantity || 1, UnitPrice: item.amount },
    })),
    ...(expirationDate && { ExpirationDate: expirationDate }),
    ...(memo && { CustomerMemo: { value: memo } }),
  };

  const data = await qbFetch(config, "estimate", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, estimate: data.Estimate, docNumber: data.Estimate?.DocNumber });
}

// ─── Create Invoice ───────────────────────────────────────────────

async function handleCreateInvoice(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { customerId, customerName, lineItems, dueDate, memo } = body as {
    customerId: string; customerName: string;
    lineItems: { description: string; amount: number; quantity?: number; serviceId?: string }[];
    dueDate?: string; memo?: string;
  };

  if (!customerId || !lineItems || (lineItems as unknown[]).length === 0) {
    throw new Error("Customer ID and line items are required");
  }

  const payload = {
    CustomerRef: { value: customerId, name: customerName },
    Line: lineItems.map(item => ({
      DetailType: "SalesItemLineDetail",
      Amount: item.amount * (item.quantity || 1),
      Description: item.description,
      SalesItemLineDetail: {
        Qty: item.quantity || 1,
        UnitPrice: item.amount,
        ...(item.serviceId && { ItemRef: { value: item.serviceId } }),
      },
    })),
    ...(dueDate && { DueDate: dueDate }),
    ...(memo && { CustomerMemo: { value: memo } }),
  };

  const data = await qbFetch(config, "invoice", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({
    success: true,
    invoice: data.Invoice,
    docNumber: data.Invoice?.DocNumber,
    totalAmount: data.Invoice?.TotalAmt,
  });
}

// ─── Create Payment ───────────────────────────────────────────────

async function handleCreatePayment(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { customerId, customerName, totalAmount, invoiceId, invoiceLines, paymentMethod, memo } = body as {
    customerId: string; customerName: string; totalAmount: number;
    invoiceId?: string; invoiceLines?: { invoiceId: string; amount: number }[];
    paymentMethod?: string; memo?: string;
  };

  if (!customerId || !totalAmount) throw new Error("Customer ID and total amount required");

  const payload: Record<string, unknown> = {
    CustomerRef: { value: customerId, name: customerName },
    TotalAmt: totalAmount,
    ...(memo && { PrivateNote: memo }),
    ...(paymentMethod && { PaymentMethodRef: { value: paymentMethod } }),
  };

  // Support multiple linked invoices (new path)
  if (invoiceLines && invoiceLines.length > 0) {
    payload.Line = invoiceLines.map((line) => ({
      Amount: line.amount,
      LinkedTxn: [{ TxnId: line.invoiceId, TxnType: "Invoice" }],
    }));
  } else if (invoiceId) {
    // Legacy single-invoice fallback
    payload.Line = [{
      Amount: totalAmount,
      LinkedTxn: [{ TxnId: invoiceId, TxnType: "Invoice" }],
    }];
  }

  const data = await qbFetch(config, "payment", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, payment: data.Payment });
}

// ─── Create Bill ──────────────────────────────────────────────────

async function handleCreateBill(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { vendorId, vendorName, lineItems, dueDate, memo } = body as {
    vendorId: string; vendorName: string;
    lineItems: { description: string; amount: number; accountId?: string }[];
    dueDate?: string; memo?: string;
  };

  if (!vendorId || !lineItems || (lineItems as unknown[]).length === 0) {
    throw new Error("Vendor ID and line items are required");
  }

  const payload = {
    VendorRef: { value: vendorId, name: vendorName },
    Line: lineItems.map(item => ({
      DetailType: "AccountBasedExpenseLineDetail",
      Amount: item.amount,
      Description: item.description,
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: item.accountId || "7" }, // default Expenses account
      },
    })),
    ...(dueDate && { DueDate: dueDate }),
    ...(memo && { PrivateNote: memo }),
  };

  const data = await qbFetch(config, "bill", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, bill: data.Bill, docNumber: data.Bill?.DocNumber });
}

// ─── Create Credit Memo ───────────────────────────────────────────

async function handleCreateCreditMemo(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { customerId, customerName, lineItems, memo } = body as {
    customerId: string; customerName: string;
    lineItems: { description: string; amount: number; quantity?: number }[];
    memo?: string;
  };

  if (!customerId || !lineItems || (lineItems as unknown[]).length === 0) {
    throw new Error("Customer ID and line items are required");
  }

  const payload = {
    CustomerRef: { value: customerId, name: customerName },
    Line: lineItems.map(item => ({
      DetailType: "SalesItemLineDetail",
      Amount: item.amount * (item.quantity || 1),
      Description: item.description,
      SalesItemLineDetail: { Qty: item.quantity || 1, UnitPrice: item.amount },
    })),
    ...(memo && { CustomerMemo: { value: memo } }),
  };

  const data = await qbFetch(config, "creditmemo", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, creditMemo: data.CreditMemo, docNumber: data.CreditMemo?.DocNumber });
}

// ─── Create Purchase Order ────────────────────────────────────────

async function handleCreatePurchaseOrder(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { vendorId, vendorName, lineItems, memo, shipAddr } = body as {
    vendorId: string; vendorName: string;
    lineItems: { description: string; amount: number; quantity?: number; itemId?: string }[];
    memo?: string; shipAddr?: string;
  };

  if (!vendorId || !lineItems || (lineItems as unknown[]).length === 0) {
    throw new Error("Vendor ID and line items are required");
  }

  const payload = {
    VendorRef: { value: vendorId, name: vendorName },
    Line: lineItems.map(item => ({
      DetailType: "ItemBasedExpenseLineDetail",
      Amount: item.amount * (item.quantity || 1),
      Description: item.description,
      ItemBasedExpenseLineDetail: {
        Qty: item.quantity || 1,
        UnitPrice: item.amount,
        ...(item.itemId && { ItemRef: { value: item.itemId } }),
      },
    })),
    ...(memo && { Memo: memo }),
    ...(shipAddr && { ShipAddr: { Line1: shipAddr } }),
  };

  const data = await qbFetch(config, "purchaseorder", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, purchaseOrder: data.PurchaseOrder, docNumber: data.PurchaseOrder?.DocNumber });
}

// ─── Create Vendor ────────────────────────────────────────────────

async function handleCreateVendor(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const b = body as Record<string, string | undefined>;

  if (!b.displayName) throw new Error("Display name is required");

  const payload: Record<string, unknown> = {
    DisplayName: b.displayName,
    ...(b.companyName && { CompanyName: b.companyName }),
    ...(b.title && { Title: b.title }),
    ...(b.firstName && { GivenName: b.firstName }),
    ...(b.middleName && { MiddleName: b.middleName }),
    ...(b.lastName && { FamilyName: b.lastName }),
    ...(b.suffix && { Suffix: b.suffix }),
    ...(b.email && { PrimaryEmailAddr: { Address: b.email } }),
    ...(b.phone && { PrimaryPhone: { FreeFormNumber: b.phone } }),
    ...(b.mobile && { Mobile: { FreeFormNumber: b.mobile } }),
    ...(b.fax && { Fax: { FreeFormNumber: b.fax } }),
    ...(b.website && { WebAddr: { URI: b.website } }),
    ...(b.printOnCheckName && { PrintOnCheckName: b.printOnCheckName }),
    ...(b.notes && { Notes: b.notes }),
  };

  // Build address if any address field provided
  const addrFields = { Line1: b.street1, Line2: b.street2, City: b.city, CountrySubDivisionCode: b.state, PostalCode: b.postalCode };
  const hasAddr = Object.values(addrFields).some(Boolean);
  if (hasAddr) {
    const addr: Record<string, string> = {};
    Object.entries(addrFields).forEach(([k, v]) => { if (v) addr[k] = v; });
    payload.BillAddr = addr;
  }

  const data = await qbFetch(config, "vendor", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, vendor: data.Vendor });
}

// ─── Create Account ───────────────────────────────────────────────

async function handleCreateAccount(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { name, accountType, accountSubType } = body as { name: string; accountType: string; accountSubType?: string };

  if (!name || !accountType) throw new Error("Account name and type are required");

  const payload: Record<string, unknown> = { Name: name, AccountType: accountType };
  if (accountSubType) payload.AccountSubType = accountSubType;

  const data = await qbFetch(config, "account", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, account: (data as any).Account });
}

// ─── Delete Transaction ───────────────────────────────────────────

async function handleDeleteTransaction(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { entityType, entityId, syncToken } = body as { entityType: string; entityId: string; syncToken: string };

  if (!entityType || !entityId) throw new Error("entityType and entityId are required");

  const endpoint = entityType.toLowerCase();
  const payload = { Id: entityId, SyncToken: syncToken || "0" };
  const data = await qbFetch(config, `${endpoint}?operation=delete`, { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, deleted: true, data });
}

// ─── Void Transaction ─────────────────────────────────────────────

async function handleVoidTransaction(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { entityType, entityId, syncToken } = body as { entityType: string; entityId: string; syncToken: string };

  if (!entityType || !entityId) throw new Error("entityType and entityId are required");

  const endpoint = entityType.toLowerCase();
  // QB void: sparse update with void=true query param
  const payload = { Id: entityId, SyncToken: syncToken || "0", sparse: true };
  const data = await qbFetch(config, `${endpoint}?operation=void`, { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, voided: true, data });
}

// ─── Create Item (Product/Service) ────────────────────────────────

async function handleCreateItem(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { name, type, unitPrice, description, incomeAccountId, expenseAccountId } = body as {
    name: string; type?: string; unitPrice?: number; description?: string;
    incomeAccountId?: string; expenseAccountId?: string;
  };

  if (!name) throw new Error("Item name is required");

  const payload: Record<string, unknown> = {
    Name: name,
    Type: type || "Service",
    ...(unitPrice !== undefined && { UnitPrice: unitPrice }),
    ...(description && { Description: description }),
    ...(incomeAccountId && { IncomeAccountRef: { value: incomeAccountId } }),
    ...(expenseAccountId && { ExpenseAccountRef: { value: expenseAccountId } }),
  };

  const data = await qbFetch(config, "item", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, item: data.Item });
}

// ─── Convert Estimate to Invoice ──────────────────────────────────

async function handleConvertEstimateToInvoice(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { estimateId } = body as { estimateId: string };

  if (!estimateId) throw new Error("Estimate ID is required");

  const estimateData = await qbFetch(config, `estimate/${estimateId}`);
  const estimate = estimateData.Estimate;

  const invoicePayload = {
    CustomerRef: estimate.CustomerRef,
    Line: estimate.Line,
    LinkedTxn: [{ TxnId: estimateId, TxnType: "Estimate" }],
  };

  const data = await qbFetch(config, "invoice", { method: "POST", body: JSON.stringify(invoicePayload) });
  return jsonRes({ success: true, invoice: data.Invoice, docNumber: data.Invoice?.DocNumber });
}

// ─── Send Invoice via Email ───────────────────────────────────────

async function handleSendInvoice(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { invoiceId, email } = body as { invoiceId: string; email?: string };

  if (!invoiceId) throw new Error("Invoice ID is required");

  const emailParam = email ? `?sendTo=${encodeURIComponent(email)}` : "";
  const data = await qbFetch(config, `invoice/${invoiceId}/send${emailParam}`, { method: "POST", body: "" });
  return jsonRes({ success: true, invoice: data.Invoice });
}

// ─── Void Invoice ─────────────────────────────────────────────────

async function handleVoidInvoice(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { invoiceId, syncToken } = body as { invoiceId: string; syncToken: string };

  if (!invoiceId || !syncToken) throw new Error("Invoice ID and SyncToken are required");

  const payload = { Id: invoiceId, SyncToken: syncToken, sparse: true };
  const data = await qbFetch(config, "invoice?operation=void", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, invoice: data.Invoice });
}

// ─── Payroll: List Employees ──────────────────────────────────────

async function handleListEmployees(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Employee");
  return jsonRes({ employees: data.QueryResponse?.Employee || [] });
}

// ─── Payroll: Get Employee ────────────────────────────────────────

async function handleGetEmployee(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { employeeId } = body as { employeeId: string };
  if (!employeeId) throw new Error("Employee ID is required");

  const data = await qbFetch(config, `employee/${employeeId}`);
  return jsonRes({ employee: data.Employee });
}

// ─── Update Invoice (sparse) ──────────────────────────────────────

async function handleUpdateInvoice(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { invoiceId, updates } = body as { invoiceId: string; updates: Record<string, unknown> };
  if (!invoiceId) throw new Error("Invoice ID is required");

  // Fetch current invoice to get latest SyncToken
  const current = await qbFetch(config, `invoice/${invoiceId}`);
  const invoice = current.Invoice;

  const payload = {
    ...invoice,
    ...updates,
    Id: invoiceId,
    SyncToken: invoice.SyncToken,
    sparse: true,
  };

  const data = await qbFetch(config, "invoice", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, invoice: data.Invoice, docNumber: data.Invoice?.DocNumber });
}

// ─── Payroll: Update Employee ─────────────────────────────────────

async function handleUpdateEmployee(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { employeeId, updates } = body as { employeeId: string; updates: Record<string, unknown> };
  if (!employeeId) throw new Error("Employee ID is required");

  // Fetch current employee to get SyncToken
  const current = await qbFetch(config, `employee/${employeeId}`);
  const employee = current.Employee;

  const payload = {
    ...employee,
    ...updates,
    Id: employeeId,
    SyncToken: employee.SyncToken,
    sparse: true,
  };

  const data = await qbFetch(config, "employee", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, employee: data.Employee });
}

// ─── Payroll: List Time Activities ────────────────────────────────

async function handleListTimeActivities(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "TimeActivity");
  return jsonRes({ timeActivities: data.QueryResponse?.TimeActivity || [] });
}

// ─── Payroll: Create Payroll Correction (Journal Entry) ───────────

async function handleCreatePayrollCorrection(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { employeeName, employeeId, lines, memo, txnDate } = body as {
    employeeName: string;
    employeeId: string;
    lines: { accountId: string; accountName: string; amount: number; type: "debit" | "credit"; description?: string }[];
    memo?: string;
    txnDate?: string;
  };

  if (!employeeId || !lines || lines.length === 0) {
    throw new Error("Employee ID and at least one journal line are required");
  }

  // Validate debits = credits
  const totalDebits = lines.filter(l => l.type === "debit").reduce((s, l) => s + l.amount, 0);
  const totalCredits = lines.filter(l => l.type === "credit").reduce((s, l) => s + l.amount, 0);
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(`Debits ($${totalDebits.toFixed(2)}) must equal Credits ($${totalCredits.toFixed(2)})`);
  }

  const payload = {
    TxnDate: txnDate || new Date().toISOString().split("T")[0],
    PrivateNote: memo || `Payroll correction for ${employeeName}`,
    Line: lines.map(line => ({
      DetailType: "JournalEntryLineDetail",
      Amount: line.amount,
      Description: line.description || `Payroll correction – ${employeeName}`,
      JournalEntryLineDetail: {
        PostingType: line.type === "debit" ? "Debit" : "Credit",
        AccountRef: { value: line.accountId, name: line.accountName },
        Entity: {
          Type: "Employee",
          EntityRef: { value: employeeId, name: employeeName },
        },
      },
    })),
  };

  const data = await qbFetch(config, "journalentry", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, journalEntry: data.JournalEntry, docNumber: data.JournalEntry?.DocNumber });
}

// ─── Account QuickReport (Transaction Register) ────────────────────

async function handleAccountQuickReport(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  const config = await getQBConfig(supabase, userId);
  const accountId = body.accountId as string;
  if (!accountId) throw new Error("accountId is required");

  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 90);

  const startDate = (body.startDate as string) || defaultStart.toISOString().slice(0, 10);
  const endDate = (body.endDate as string) || today.toISOString().slice(0, 10);

  const report = await qbFetch(
    config,
    `reports/TransactionListByAccount?account=${accountId}&start_date=${startDate}&end_date=${endDate}&columns=tx_date,txn_type,doc_num,name,memo,account,subt_nat_amount,rbal_nat_amount`,
  ) as Record<string, unknown>;

  // Parse the QB report response
  const transactions: { date: string; type: string; num: string; name: string; memo: string; account: string; amount: number; balance: number }[] = [];
  let beginningBalance = 0;

  const columns = (report.Columns as any)?.Column || [];
  const colNames = columns.map((c: any) => c.ColTitle as string);

  function parseRows(rows: any[]) {
    for (const row of rows) {
      if (row.Header?.ColData) {
        // Section header (account grouping) — check for beginning balance
        const headerText = row.Header.ColData[0]?.value || "";
        if (headerText === "Beginning Balance") {
          const balCol = row.Header.ColData[colNames.length - 1];
          beginningBalance = parseFloat(balCol?.value || "0");
        }
      }
      if (row.Rows?.Row) {
        parseRows(row.Rows.Row);
}

// ─── Sales Receipts ───────────────────────────────────────────────

async function handleListSalesReceipts(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "SalesReceipt");
  return jsonRes({ salesReceipts: data.QueryResponse?.SalesReceipt || [] });
}

async function handleCreateSalesReceipt(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { customerId, customerName, lineItems, memo, depositToAccountId, paymentMethodId } = body as {
    customerId: string; customerName: string;
    lineItems: { description: string; amount: number; quantity?: number; serviceId?: string }[];
    memo?: string; depositToAccountId?: string; paymentMethodId?: string;
  };
  if (!customerId || !lineItems || lineItems.length === 0) throw new Error("Customer ID and line items required");

  const payload: Record<string, unknown> = {
    CustomerRef: { value: customerId, name: customerName },
    Line: lineItems.map(item => ({
      DetailType: "SalesItemLineDetail",
      Amount: item.amount * (item.quantity || 1),
      Description: item.description,
      SalesItemLineDetail: { Qty: item.quantity || 1, UnitPrice: item.amount, ...(item.serviceId && { ItemRef: { value: item.serviceId } }) },
    })),
    ...(memo && { CustomerMemo: { value: memo } }),
    ...(depositToAccountId && { DepositToAccountRef: { value: depositToAccountId } }),
    ...(paymentMethodId && { PaymentMethodRef: { value: paymentMethodId } }),
  };

  const data = await qbFetch(config, "salesreceipt", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, salesReceipt: (data as any).SalesReceipt, docNumber: (data as any).SalesReceipt?.DocNumber });
}

// ─── Refund Receipts ──────────────────────────────────────────────

async function handleListRefundReceipts(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "RefundReceipt");
  return jsonRes({ refundReceipts: data.QueryResponse?.RefundReceipt || [] });
}

async function handleCreateRefundReceipt(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { customerId, customerName, lineItems, memo, depositToAccountId } = body as {
    customerId: string; customerName: string;
    lineItems: { description: string; amount: number; quantity?: number; serviceId?: string }[];
    memo?: string; depositToAccountId?: string;
  };
  if (!customerId || !lineItems || lineItems.length === 0) throw new Error("Customer ID and line items required");

  const payload: Record<string, unknown> = {
    CustomerRef: { value: customerId, name: customerName },
    Line: lineItems.map(item => ({
      DetailType: "SalesItemLineDetail",
      Amount: item.amount * (item.quantity || 1),
      Description: item.description,
      SalesItemLineDetail: { Qty: item.quantity || 1, UnitPrice: item.amount, ...(item.serviceId && { ItemRef: { value: item.serviceId } }) },
    })),
    ...(memo && { CustomerMemo: { value: memo } }),
    ...(depositToAccountId && { DepositToAccountRef: { value: depositToAccountId } }),
  };

  const data = await qbFetch(config, "refundreceipt", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, refundReceipt: (data as any).RefundReceipt, docNumber: (data as any).RefundReceipt?.DocNumber });
}

// ─── Deposits ─────────────────────────────────────────────────────

async function handleListDeposits(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Deposit");
  return jsonRes({ deposits: data.QueryResponse?.Deposit || [] });
}

async function handleCreateDeposit(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { depositToAccountId, lineItems, memo, txnDate } = body as {
    depositToAccountId: string;
    lineItems: { amount: number; accountId: string; description?: string; entityType?: string; entityId?: string }[];
    memo?: string; txnDate?: string;
  };
  if (!depositToAccountId || !lineItems || lineItems.length === 0) throw new Error("Deposit account and line items required");

  const payload: Record<string, unknown> = {
    DepositToAccountRef: { value: depositToAccountId },
    Line: lineItems.map(item => ({
      Amount: item.amount,
      DetailType: "DepositLineDetail",
      DepositLineDetail: {
        AccountRef: { value: item.accountId },
        ...(item.description && { memo: item.description }),
        ...(item.entityType && item.entityId && { Entity: { Type: item.entityType, EntityRef: { value: item.entityId } } }),
      },
    })),
    ...(memo && { PrivateNote: memo }),
    ...(txnDate && { TxnDate: txnDate }),
  };

  const data = await qbFetch(config, "deposit", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, deposit: (data as any).Deposit, docNumber: (data as any).Deposit?.DocNumber });
}

// ─── Bank Transfer ────────────────────────────────────────────────

async function handleCreateTransfer(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { fromAccountId, toAccountId, amount, memo, txnDate } = body as {
    fromAccountId: string; toAccountId: string; amount: number; memo?: string; txnDate?: string;
  };
  if (!fromAccountId || !toAccountId || !amount) throw new Error("From/To accounts and amount required");

  const payload: Record<string, unknown> = {
    FromAccountRef: { value: fromAccountId },
    ToAccountRef: { value: toAccountId },
    Amount: amount,
    ...(memo && { PrivateNote: memo }),
    ...(txnDate && { TxnDate: txnDate }),
  };

  const data = await qbFetch(config, "transfer", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, transfer: (data as any).Transfer });
}

// ─── General Journal Entries ──────────────────────────────────────

async function handleListJournalEntries(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "JournalEntry");
  return jsonRes({ journalEntries: data.QueryResponse?.JournalEntry || [] });
}

async function handleCreateJournalEntry(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const { lines, memo, txnDate } = body as {
    lines: { accountId: string; accountName: string; amount: number; type: "debit" | "credit"; description?: string }[];
    memo?: string; txnDate?: string;
  };
  if (!lines || lines.length === 0) throw new Error("At least one journal line required");

  const totalDebits = lines.filter(l => l.type === "debit").reduce((s, l) => s + l.amount, 0);
  const totalCredits = lines.filter(l => l.type === "credit").reduce((s, l) => s + l.amount, 0);
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(`Debits ($${totalDebits.toFixed(2)}) must equal Credits ($${totalCredits.toFixed(2)})`);
  }

  const payload = {
    TxnDate: txnDate || new Date().toISOString().split("T")[0],
    PrivateNote: memo || "General journal entry",
    Line: lines.map(line => ({
      DetailType: "JournalEntryLineDetail",
      Amount: line.amount,
      Description: line.description || "",
      JournalEntryLineDetail: {
        PostingType: line.type === "debit" ? "Debit" : "Credit",
        AccountRef: { value: line.accountId, name: line.accountName },
      },
    })),
  };

  const data = await qbFetch(config, "journalentry", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, journalEntry: (data as any).JournalEntry, docNumber: (data as any).JournalEntry?.DocNumber });
}

// ─── Aged Receivables Report ──────────────────────────────────────

async function handleGetAgedReceivables(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const asOfDate = (body.asOfDate as string) || new Date().toISOString().split("T")[0];
  const data = await qbFetch(config, `reports/AgedReceivableDetail?report_date=${asOfDate}`);
  return jsonRes({ report: data });
}

// ─── Aged Payables Report ─────────────────────────────────────────

async function handleGetAgedPayables(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const asOfDate = (body.asOfDate as string) || new Date().toISOString().split("T")[0];
  const data = await qbFetch(config, `reports/AgedPayableDetail?report_date=${asOfDate}`);
  return jsonRes({ report: data });
}

// ─── General Ledger Report ────────────────────────────────────────

async function handleGetGeneralLedger(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const startDate = (body.startDate as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const endDate = (body.endDate as string) || new Date().toISOString().split("T")[0];
  const data = await qbFetch(config, `reports/GeneralLedger?start_date=${startDate}&end_date=${endDate}&columns=tx_date,txn_type,doc_num,name,memo,account,subt_nat_amount,rbal_nat_amount`);
  return jsonRes({ report: data });
}

// ─── Trial Balance Report ─────────────────────────────────────────

async function handleGetTrialBalance(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const asOfDate = (body.asOfDate as string) || new Date().toISOString().split("T")[0];
  const data = await qbFetch(config, `reports/TrialBalance?report_date=${asOfDate}`);
  return jsonRes({ report: data });
}

// ─── Transaction List by Date ─────────────────────────────────────

async function handleGetTransactionList(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const startDate = (body.startDate as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const endDate = (body.endDate as string) || new Date().toISOString().split("T")[0];
  const data = await qbFetch(config, `reports/TransactionList?start_date=${startDate}&end_date=${endDate}&columns=tx_date,txn_type,doc_num,name,memo,account,subt_nat_amount`);
  return jsonRes({ report: data });
}
      if (row.ColData) {
        const vals = row.ColData.map((c: any) => c.value || "");
        transactions.push({
          date: vals[colNames.indexOf("Date")] || vals[0] || "",
          type: vals[colNames.indexOf("Transaction Type")] || vals[1] || "",
          num: vals[colNames.indexOf("Num")] || vals[2] || "",
          name: vals[colNames.indexOf("Name")] || vals[3] || "",
          memo: vals[colNames.indexOf("Memo/Description")] || vals[4] || "",
          account: vals[colNames.indexOf("Account")] || vals[5] || "",
          amount: parseFloat(vals[colNames.indexOf("Amount")] || vals[6] || "0"),
          balance: parseFloat(vals[colNames.indexOf("Balance")] || vals[7] || "0"),
        });
      }
    }
  }

  const reportRows = (report.Rows as any)?.Row || [];
  parseRows(reportRows);

  return jsonRes({ transactions, beginningBalance, startDate, endDate });
}

// ═══════════════════════════════════════════════════════════════════
// Phase 17: New Action Handlers
// ═══════════════════════════════════════════════════════════════════

// ─── Cash Flow Report ─────────────────────────────────────────────

async function handleGetCashFlow(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const startDate = (body.startDate as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const endDate = (body.endDate as string) || new Date().toISOString().split("T")[0];
  const data = await qbFetch(config, `reports/CashFlow?start_date=${startDate}&end_date=${endDate}`);
  return jsonRes({ report: data });
}

// ─── Tax Summary Report ───────────────────────────────────────────

async function handleGetTaxSummary(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const startDate = (body.startDate as string) || new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
  const endDate = (body.endDate as string) || new Date().toISOString().split("T")[0];
  const data = await qbFetch(config, `reports/TaxSummary?start_date=${startDate}&end_date=${endDate}`);
  return jsonRes({ report: data });
}

// ─── Bill Payments ────────────────────────────────────────────────

async function handleCreateBillPayment(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const payload = body.billPayment as Record<string, unknown>;
  if (!payload) throw new Error("Missing billPayment payload");
  const data = await qbFetch(config, "billpayment", { method: "POST", body: JSON.stringify(payload) });
  await updateLastSync(supabase, userId);
  return jsonRes(data);
}

async function handleListBillPayments(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "BillPayment");
  return jsonRes(data);
}

// ─── Customer/Vendor Write-Back ───────────────────────────────────

async function handleUpdateCustomer(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const customer = body.customer as Record<string, unknown>;
  if (!customer?.Id || !customer?.SyncToken) throw new Error("Missing customer Id/SyncToken for sparse update");
  customer.sparse = true;
  const data = await qbFetch(config, "customer", { method: "POST", body: JSON.stringify(customer) });
  await updateLastSync(supabase, userId);
  return jsonRes(data);
}

async function handleUpdateVendor(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const vendor = body.vendor as Record<string, unknown>;
  if (!vendor?.Id || !vendor?.SyncToken) throw new Error("Missing vendor Id/SyncToken for sparse update");
  vendor.sparse = true;
  const data = await qbFetch(config, "vendor", { method: "POST", body: JSON.stringify(vendor) });
  await updateLastSync(supabase, userId);
  return jsonRes(data);
}

// ─── Classes & Departments ────────────────────────────────────────

async function handleListClasses(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Class");
  return jsonRes(data);
}

async function handleListDepartments(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Department");
  return jsonRes(data);
}

async function handleCreateClass(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const cls = body.class as Record<string, unknown>;
  if (!cls?.Name) throw new Error("Missing class Name");
  const data = await qbFetch(config, "class", { method: "POST", body: JSON.stringify(cls) });
  await updateLastSync(supabase, userId);
  return jsonRes(data);
}

// ─── Purchase (Expense) Creation ──────────────────────────────────

async function handleCreatePurchase(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const purchase = body.purchase as Record<string, unknown>;
  if (!purchase) throw new Error("Missing purchase payload");
  const data = await qbFetch(config, "purchase", { method: "POST", body: JSON.stringify(purchase) });
  await updateLastSync(supabase, userId);
  return jsonRes(data);
}

// ─── Attachments API ──────────────────────────────────────────────

async function handleUploadAttachment(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const attachable = body.attachable as Record<string, unknown>;
  if (!attachable) throw new Error("Missing attachable payload");
  // Create attachable metadata (link file to entity)
  const data = await qbFetch(config, "attachable", { method: "POST", body: JSON.stringify(attachable) });
  await updateLastSync(supabase, userId);
  return jsonRes(data);
}

async function handleListAttachments(supabase: ReturnType<typeof createClient>, userId: string, body: Record<string, unknown>) {
  const config = await getQBConfig(supabase, userId);
  const entityType = body.entityType as string;
  const entityId = body.entityId as string;
  let whereClause: string | undefined;
  if (entityType && entityId) {
    whereClause = `AttachableRef.EntityRef.Type = '${entityType}' AND AttachableRef.EntityRef.value = '${entityId}'`;
  }
  const data = await qbQuery(config, "Attachable", 1000, whereClause);
  return jsonRes(data);
}
