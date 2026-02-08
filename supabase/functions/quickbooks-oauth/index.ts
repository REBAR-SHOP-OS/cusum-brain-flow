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
  if (error || !data?.claims) return null;
  return data.claims.sub as string;
}

/** Get the user's QuickBooks connection (using service role) */
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

    // ─── Handle callback from QuickBooks OAuth (no auth header) ────
    if (pathAction === "callback") {
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

      if (!code || !realmId) {
        throw new Error("Missing code or realmId in callback");
      }

      // Extract user_id from state (format: "userId|returnUrl")
      let userId = "";
      let returnUrl = "";
      if (state) {
        const parts = state.split("|");
        userId = parts[0] || "";
        returnUrl = parts.slice(1).join("|") || "";
      }

      if (!userId) {
        throw new Error("Missing user context in OAuth callback");
      }

      // Exchange code for tokens
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

      // Store tokens per-user
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

      // Redirect back to integrations page
      const redirectTarget = returnUrl || `${url.origin}/integrations`;
      return new Response(null, {
        status: 302,
        headers: { Location: redirectTarget.replace("preview--", "") },
      });
    }

    // ─── All other actions require authentication ──────────────────
    const userId = await verifyAuth(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));

    // ─── Get auth URL ──────────────────────────────────────────────
    if (body.action === "get-auth-url") {
      const redirectUri = `${supabaseUrl}/functions/v1/quickbooks-oauth/callback`;
      const scope = "com.intuit.quickbooks.accounting";
      // Encode user_id and return URL in state
      const state = `${userId}|${body.returnUrl || ""}`;

      const authUrl = new URL(QUICKBOOKS_AUTH_URL);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scope);
      authUrl.searchParams.set("state", state);

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Check connection status (per-user) ────────────────────────
    if (body.action === "check-status") {
      const connection = await getUserQBConnection(supabase, userId);

      if (!connection) {
        return new Response(JSON.stringify({ status: "available" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const config = connection.config as {
        realm_id: string;
        access_token: string;
        refresh_token: string;
        expires_at: number;
      };

      // Refresh token if expired
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
        } catch (error) {
          console.error("Token refresh failed:", error);
          await supabase
            .from("integration_connections")
            .update({
              status: "error",
              error_message: "Token expired, please reconnect",
            })
            .eq("user_id", userId)
            .eq("integration_id", "quickbooks");

          return new Response(JSON.stringify({
            status: "error",
            error: "Token expired, please reconnect",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({
        status: "connected",
        realmId: config.realm_id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Disconnect (per-user) ─────────────────────────────────────
    if (body.action === "disconnect") {
      await supabase
        .from("integration_connections")
        .delete()
        .eq("user_id", userId)
        .eq("integration_id", "quickbooks");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Sync customers from QuickBooks (per-user) ─────────────────
    if (body.action === "sync-customers") {
      const connection = await getUserQBConnection(supabase, userId);
      if (!connection) throw new Error("QuickBooks not connected");

      const config = connection.config as { realm_id: string; access_token: string };

      // Get user's company_id for multi-tenant isolation
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", userId)
        .maybeSingle();
      const companyId = profile?.company_id;
      if (!companyId) throw new Error("User has no company assigned");

      const qbResponse = await fetch(
        `${QUICKBOOKS_API_BASE}/v3/company/${config.realm_id}/query?query=SELECT * FROM Customer MAXRESULTS 1000`,
        {
          headers: {
            "Authorization": `Bearer ${config.access_token}`,
            "Accept": "application/json",
          },
        }
      );

      if (!qbResponse.ok) {
        const errorText = await qbResponse.text();
        console.error("QuickBooks API error:", errorText);
        throw new Error("Failed to fetch customers from QuickBooks");
      }

      const qbData = await qbResponse.json();
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

        if (!error) {
          synced++;
        } else {
          errors.push(`${customer.DisplayName}: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        console.error("Customer sync errors:", errors.slice(0, 5));
      }

      await supabase
        .from("integration_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("integration_id", "quickbooks");

      return new Response(JSON.stringify({ success: true, synced, total: customers.length, errors: errors.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Sync invoices from QuickBooks (per-user) ──────────────────
    if (body.action === "sync-invoices") {
      const connection = await getUserQBConnection(supabase, userId);
      if (!connection) throw new Error("QuickBooks not connected");

      const config = connection.config as { realm_id: string; access_token: string };

      // Get user's company_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", userId)
        .maybeSingle();
      const companyId = profile?.company_id;
      if (!companyId) throw new Error("User has no company assigned");

      const qbResponse = await fetch(
        `${QUICKBOOKS_API_BASE}/v3/company/${config.realm_id}/query?query=SELECT * FROM Invoice MAXRESULTS 1000`,
        {
          headers: {
            "Authorization": `Bearer ${config.access_token}`,
            "Accept": "application/json",
          },
        }
      );

      if (!qbResponse.ok) {
        const errorText = await qbResponse.text();
        console.error("QuickBooks Invoice API error:", errorText);
        throw new Error("Failed to fetch invoices from QuickBooks");
      }

      const qbData = await qbResponse.json();
      const invoices = qbData.QueryResponse?.Invoice || [];

      let synced = 0;
      for (const invoice of invoices) {
        // Map QB customer to local customer
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
            },
            last_synced_at: new Date().toISOString(),
          }, { onConflict: "quickbooks_id" });

        if (!error) synced++;
        else console.error(`Invoice sync error (${invoice.Id}):`, error.message);
      }

      await supabase
        .from("integration_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("integration_id", "quickbooks");

      return new Response(JSON.stringify({ success: true, synced, total: invoices.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Get company info (per-user) ───────────────────────────────
    if (body.action === "get-company-info") {
      const connection = await getUserQBConnection(supabase, userId);
      if (!connection) throw new Error("QuickBooks not connected");

      const config = connection.config as { realm_id: string; access_token: string };

      const qbResponse = await fetch(
        `${QUICKBOOKS_API_BASE}/v3/company/${config.realm_id}/companyinfo/${config.realm_id}`,
        {
          headers: {
            "Authorization": `Bearer ${config.access_token}`,
            "Accept": "application/json",
          },
        }
      );

      if (!qbResponse.ok) throw new Error("Failed to fetch company info");

      const data = await qbResponse.json();
      return new Response(JSON.stringify(data.CompanyInfo), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Create Estimate (per-user) ────────────────────────────────
    if (body.action === "create-estimate") {
      const connection = await getUserQBConnection(supabase, userId);
      if (!connection) throw new Error("QuickBooks not connected");

      const config = connection.config as { realm_id: string; access_token: string };
      const { customerId, customerName, lineItems, expirationDate, memo } = body;

      if (!customerId || !lineItems || lineItems.length === 0) {
        throw new Error("Customer ID and line items are required");
      }

      const estimatePayload = {
        CustomerRef: { value: customerId, name: customerName },
        Line: lineItems.map((item: { description: string; amount: number; quantity?: number }) => ({
          DetailType: "SalesItemLineDetail",
          Amount: item.amount * (item.quantity || 1),
          Description: item.description,
          SalesItemLineDetail: { Qty: item.quantity || 1, UnitPrice: item.amount },
        })),
        ...(expirationDate && { ExpirationDate: expirationDate }),
        ...(memo && { CustomerMemo: { value: memo } }),
      };

      const qbResponse = await fetch(
        `${QUICKBOOKS_API_BASE}/v3/company/${config.realm_id}/estimate`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.access_token}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(estimatePayload),
        }
      );

      if (!qbResponse.ok) {
        const errorText = await qbResponse.text();
        console.error("QuickBooks create estimate error:", errorText);
        throw new Error(`Failed to create estimate: ${qbResponse.status}`);
      }

      const estimateData = await qbResponse.json();
      return new Response(JSON.stringify({
        success: true,
        estimate: estimateData.Estimate,
        docNumber: estimateData.Estimate?.DocNumber,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Create Invoice (per-user) ─────────────────────────────────
    if (body.action === "create-invoice") {
      const connection = await getUserQBConnection(supabase, userId);
      if (!connection) throw new Error("QuickBooks not connected");

      const config = connection.config as { realm_id: string; access_token: string };
      const { customerId, customerName, lineItems, dueDate, memo } = body;

      if (!customerId || !lineItems || lineItems.length === 0) {
        throw new Error("Customer ID and line items are required");
      }

      const invoicePayload = {
        CustomerRef: { value: customerId, name: customerName },
        Line: lineItems.map((item: { description: string; amount: number; quantity?: number; serviceId?: string }) => ({
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

      const qbResponse = await fetch(
        `${QUICKBOOKS_API_BASE}/v3/company/${config.realm_id}/invoice`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.access_token}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invoicePayload),
        }
      );

      if (!qbResponse.ok) {
        const errorText = await qbResponse.text();
        console.error("QuickBooks create invoice error:", errorText);
        throw new Error(`Failed to create invoice: ${qbResponse.status}`);
      }

      const invoiceData = await qbResponse.json();
      return new Response(JSON.stringify({
        success: true,
        invoice: invoiceData.Invoice,
        docNumber: invoiceData.Invoice?.DocNumber,
        totalAmount: invoiceData.Invoice?.TotalAmt,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Convert Estimate to Invoice (per-user) ────────────────────
    if (body.action === "convert-estimate-to-invoice") {
      const connection = await getUserQBConnection(supabase, userId);
      if (!connection) throw new Error("QuickBooks not connected");

      const config = connection.config as { realm_id: string; access_token: string };
      const { estimateId } = body;

      if (!estimateId) throw new Error("Estimate ID is required");

      const estimateRes = await fetch(
        `${QUICKBOOKS_API_BASE}/v3/company/${config.realm_id}/estimate/${estimateId}`,
        {
          headers: {
            "Authorization": `Bearer ${config.access_token}`,
            "Accept": "application/json",
          },
        }
      );

      if (!estimateRes.ok) throw new Error("Failed to fetch estimate");

      const estimateData = await estimateRes.json();
      const estimate = estimateData.Estimate;

      const invoicePayload = {
        CustomerRef: estimate.CustomerRef,
        Line: estimate.Line,
        LinkedTxn: [{ TxnId: estimateId, TxnType: "Estimate" }],
      };

      const invoiceRes = await fetch(
        `${QUICKBOOKS_API_BASE}/v3/company/${config.realm_id}/invoice`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.access_token}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(invoicePayload),
        }
      );

      if (!invoiceRes.ok) {
        const errorText = await invoiceRes.text();
        console.error("Convert estimate error:", errorText);
        throw new Error("Failed to convert estimate to invoice");
      }

      const invoiceData = await invoiceRes.json();
      return new Response(JSON.stringify({
        success: true,
        invoice: invoiceData.Invoice,
        docNumber: invoiceData.Invoice?.DocNumber,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("QuickBooks OAuth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});