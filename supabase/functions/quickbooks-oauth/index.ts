import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QUICKBOOKS_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QUICKBOOKS_API_BASE = "https://sandbox-quickbooks.api.intuit.com";

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
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

async function getUserQBConnection(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("integration_id", "quickbooks")
    .maybeSingle();

  if (!connection || connection.status !== "connected") return null;
  return connection;
}

async function getQBConfig(supabase: ReturnType<typeof createClient>, userId: string) {
  const connection = await getUserQBConnection(supabase, userId);
  if (!connection) throw new Error("QuickBooks not connected");
  return connection.config as { realm_id: string; access_token: string; refresh_token: string; expires_at: number };
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

async function qbFetch(config: { realm_id: string; access_token: string }, path: string, options?: RequestInit) {
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
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`QB API error [${path}]:`, errorText);
    throw new Error(`QuickBooks API error (${res.status}): ${path}`);
  }
  return res.json();
}

function qbQuery(config: { realm_id: string; access_token: string }, entity: string, maxResults = 1000) {
  return qbFetch(config, `query?query=SELECT * FROM ${entity} MAXRESULTS ${maxResults}`);
}

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function updateLastSync(supabase: ReturnType<typeof createClient>, userId: string) {
  return supabase
    .from("integration_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("integration_id", "quickbooks");
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
      case "list-accounts":
        return handleListAccounts(supabase, userId);
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
      case "create-item":
        return handleCreateItem(supabase, userId, body);
      case "convert-estimate-to-invoice":
        return handleConvertEstimateToInvoice(supabase, userId, body);
      case "send-invoice":
        return handleSendInvoice(supabase, userId, body);
      case "void-invoice":
        return handleVoidInvoice(supabase, userId, body);

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
  const scope = "com.intuit.quickbooks.accounting";
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
          .eq("user_id", userId)
          .eq("integration_id", "quickbooks");
      } else {
        throw new Error("Token refresh failed");
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
      await supabase
        .from("integration_connections")
        .update({ status: "error", error_message: "Token expired, please reconnect" })
        .eq("user_id", userId)
        .eq("integration_id", "quickbooks");

      return jsonRes({ status: "error", error: "Token expired, please reconnect" });
    }
  }

  return jsonRes({ status: "connected", realmId: config.realm_id });
}

// ─── Disconnect ────────────────────────────────────────────────────

async function handleDisconnect(supabase: ReturnType<typeof createClient>, userId: string) {
  await supabase
    .from("integration_connections")
    .delete()
    .eq("user_id", userId)
    .eq("integration_id", "quickbooks");

  return jsonRes({ success: true });
}

// ─── Get Company Info ──────────────────────────────────────────────

async function handleGetCompanyInfo(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbFetch(config, `companyinfo/${config.realm_id}`);
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
  for (const customer of customers) {
    const { error } = await supabase
      .from("customers")
      .upsert({
        quickbooks_id: customer.Id,
        name: customer.DisplayName,
        company_name: customer.CompanyName || null,
        company_id: companyId,
        notes: customer.Notes || null,
        credit_limit: customer.CreditLimit || null,
        payment_terms: customer.SalesTermRef?.name || null,
        status: customer.Active ? "active" : "inactive",
      }, { onConflict: "quickbooks_id" });

    if (!error) synced++;
    else errors.push(`${customer.DisplayName}: ${error.message}`);
  }

  if (errors.length > 0) console.error("Customer sync errors:", errors.slice(0, 5));
  await updateLastSync(supabase, userId);

  return jsonRes({ success: true, synced, total: customers.length, errors: errors.length });
}

// ─── Sync Invoices ─────────────────────────────────────────────────

async function handleSyncInvoices(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);

  const qbData = await qbQuery(config, "Invoice");
  const invoices = qbData.QueryResponse?.Invoice || [];

  let synced = 0;
  for (const invoice of invoices) {
    let customerId: string | null = null;
    if (invoice.CustomerRef?.value) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("quickbooks_id", invoice.CustomerRef.value)
        .maybeSingle();
      customerId = customer?.id || null;
    }

    const { error } = await supabase
      .from("accounting_mirror")
      .upsert({
        quickbooks_id: invoice.Id,
        entity_type: "Invoice",
        balance: invoice.Balance || 0,
        customer_id: customerId,
        data: {
          DocNumber: invoice.DocNumber,
          TotalAmt: invoice.TotalAmt,
          DueDate: invoice.DueDate,
          TxnDate: invoice.TxnDate,
          CustomerName: invoice.CustomerRef?.name,
          EmailStatus: invoice.EmailStatus,
          Balance: invoice.Balance,
          Line: invoice.Line,
        },
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "quickbooks_id" });

    if (!error) synced++;
    else console.error(`Invoice sync error (${invoice.Id}):`, error.message);
  }

  await updateLastSync(supabase, userId);
  return jsonRes({ success: true, synced, total: invoices.length });
}

// ─── Sync Vendors ──────────────────────────────────────────────────

async function handleSyncVendors(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);

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

// ─── List Entities (direct from QB API) ───────────────────────────

async function handleListAccounts(supabase: ReturnType<typeof createClient>, userId: string) {
  const config = await getQBConfig(supabase, userId);
  const data = await qbQuery(config, "Account");
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
  const data = await qbFetch(config, `reports/BalanceSheet?date_macro=Custom&end_date=${asOfDate}`);
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
  const { customerId, customerName, totalAmount, invoiceId, paymentMethod, memo } = body as {
    customerId: string; customerName: string; totalAmount: number;
    invoiceId?: string; paymentMethod?: string; memo?: string;
  };

  if (!customerId || !totalAmount) throw new Error("Customer ID and total amount required");

  const payload: Record<string, unknown> = {
    CustomerRef: { value: customerId, name: customerName },
    TotalAmt: totalAmount,
    ...(memo && { PrivateNote: memo }),
    ...(paymentMethod && { PaymentMethodRef: { value: paymentMethod } }),
  };

  if (invoiceId) {
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
  const { displayName, companyName, email, phone, notes } = body as {
    displayName: string; companyName?: string; email?: string; phone?: string; notes?: string;
  };

  if (!displayName) throw new Error("Display name is required");

  const payload: Record<string, unknown> = {
    DisplayName: displayName,
    ...(companyName && { CompanyName: companyName }),
    ...(email && { PrimaryEmailAddr: { Address: email } }),
    ...(phone && { PrimaryPhone: { FreeFormNumber: phone } }),
    ...(notes && { Notes: notes }),
  };

  const data = await qbFetch(config, "vendor", { method: "POST", body: JSON.stringify(payload) });
  return jsonRes({ success: true, vendor: data.Vendor });
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
