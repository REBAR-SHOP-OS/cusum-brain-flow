import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUICKBOOKS_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

// QuickBooks Sandbox API (use production URL in prod)
const QUICKBOOKS_API_BASE = "https://sandbox-quickbooks.api.intuit.com";

serve(async (req) => {
  // Handle CORS preflight
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
    const action = pathParts[pathParts.length - 1];

    // Handle callback from QuickBooks OAuth
    if (action === "callback") {
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

      // Store tokens in integration_connections table
      const { error: dbError } = await supabase
        .from("integration_connections")
        .upsert({
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
        }, { onConflict: "integration_id" });

      if (dbError) {
        console.error("Failed to store tokens:", dbError);
        throw new Error("Failed to store tokens");
      }

      // Redirect back to integrations page
      const redirectUrl = state || `${url.origin}/integrations`;
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl.replace("preview--", "") },
      });
    }

    // Parse JSON body for other actions
    const body = await req.json().catch(() => ({}));

    // Get auth URL
    if (body.action === "get-auth-url") {
      const redirectUri = `${supabaseUrl}/functions/v1/quickbooks-oauth/callback`;
      const scope = "com.intuit.quickbooks.accounting";
      const state = body.returnUrl || "";

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

    // Check connection status
    if (body.action === "check-status") {
      const { data: connection } = await supabase
        .from("integration_connections")
        .select("*")
        .eq("integration_id", "quickbooks")
        .single();

      if (!connection || connection.status !== "connected") {
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

      // Check if token is expired and refresh if needed
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
            .eq("integration_id", "quickbooks");

          return new Response(JSON.stringify({ 
            status: "error", 
            error: "Token expired, please reconnect" 
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

    // Sync customers from QuickBooks
    if (body.action === "sync-customers") {
      const { data: connection } = await supabase
        .from("integration_connections")
        .select("*")
        .eq("integration_id", "quickbooks")
        .single();

      if (!connection || connection.status !== "connected") {
        throw new Error("QuickBooks not connected");
      }

      const config = connection.config as { 
        realm_id: string; 
        access_token: string;
      };

      // Fetch customers from QuickBooks
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
            notes: customer.Notes || null,
            credit_limit: customer.CreditLimit || null,
            payment_terms: customer.SalesTermRef?.name || null,
          }, { onConflict: "quickbooks_id" });

        if (error) {
          console.error("Upsert error for customer", customer.Id, error);
          errors.push(`${customer.Id}: ${error.message}`);
        } else {
          synced++;
        }
      }

      // Update last sync time
      await supabase
        .from("integration_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("integration_id", "quickbooks");

      return new Response(JSON.stringify({ 
        success: true, 
        synced,
        total: customers.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company info
    if (body.action === "get-company-info") {
      const { data: connection } = await supabase
        .from("integration_connections")
        .select("*")
        .eq("integration_id", "quickbooks")
        .single();

      if (!connection || connection.status !== "connected") {
        throw new Error("QuickBooks not connected");
      }

      const config = connection.config as { 
        realm_id: string; 
        access_token: string;
      };

      const qbResponse = await fetch(
        `${QUICKBOOKS_API_BASE}/v3/company/${config.realm_id}/companyinfo/${config.realm_id}`,
        {
          headers: {
            "Authorization": `Bearer ${config.access_token}`,
            "Accept": "application/json",
          },
        }
      );

      if (!qbResponse.ok) {
        throw new Error("Failed to fetch company info");
      }

      const data = await qbResponse.json();
      return new Response(JSON.stringify(data.CompanyInfo), {
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
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
