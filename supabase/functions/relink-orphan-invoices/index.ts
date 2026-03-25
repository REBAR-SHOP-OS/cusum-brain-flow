import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

const QUICKBOOKS_API_BASE = Deno.env.get("QUICKBOOKS_ENVIRONMENT") === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com";

const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

async function refreshQBToken(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  config: { refresh_token: string; access_token: string },
): Promise<string> {
  const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID")!;
  const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET")!;

  const res = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refresh_token,
    }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const tokens = await res.json();

  await supabase
    .from("integration_connections")
    .update({
      config: {
        ...config,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || config.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
      },
      status: "connected",
    })
    .eq("id", connectionId);

  return tokens.access_token;
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { serviceClient: supabase, companyId } = ctx;

    // Find QB connection
    const { data: connections } = await supabase
      .from("integration_connections")
      .select("id, config")
      .eq("integration_id", "quickbooks")
      .eq("status", "connected");

    const conn = connections?.find((c: any) => {
      const cfg = c.config as any;
      return cfg?.company_id === companyId || cfg?.realm_id;
    });
    if (!conn) throw new Error("No QuickBooks connection found");

    const config = conn.config as any;
    let accessToken = config.access_token;

    // Refresh if expired
    if (config.expires_at && config.expires_at < Date.now()) {
      accessToken = await refreshQBToken(supabase, conn.id, config);
    }

    // Get orphaned invoices
    const { data: orphaned } = await supabase
      .from("accounting_mirror")
      .select("id, quickbooks_id")
      .eq("entity_type", "Invoice")
      .is("customer_id", null);

    if (!orphaned || orphaned.length === 0) {
      return new Response(JSON.stringify({ linked: 0, message: "No orphaned invoices" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qbIds = orphaned.map((o: any) => `'${o.quickbooks_id}'`).join(",");
    const query = `SELECT * FROM Invoice WHERE Id IN (${qbIds})`;

    const qbRes = await fetch(
      `${QUICKBOOKS_API_BASE}/v3/company/${config.realm_id}/query?query=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    if (qbRes.status === 401) {
      accessToken = await refreshQBToken(supabase, conn.id, config);
      const retryRes = await fetch(
        `${QUICKBOOKS_API_BASE}/v3/company/${config.realm_id}/query?query=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        },
      );
      if (!retryRes.ok) throw new Error(`QB API error: ${retryRes.status}`);
      var qbData = await retryRes.json();
    } else if (!qbRes.ok) {
      throw new Error(`QB API error: ${qbRes.status}`);
    } else {
      var qbData = await qbRes.json();
    }

    const invoices = qbData?.QueryResponse?.Invoice || [];
    let linked = 0;
    let notFound = 0;
    const details: any[] = [];

    for (const inv of invoices) {
      const custRef = inv.CustomerRef?.value;
      if (!custRef) {
        details.push({ qbId: inv.Id, error: "No CustomerRef" });
        continue;
      }

      // Find ERP customer by QB ID
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("quickbooks_id", custRef)
        .maybeSingle();

      if (!customer) {
        details.push({ qbId: inv.Id, custRefValue: custRef, error: "No matching customer" });
        notFound++;
        continue;
      }

      // Update both customer_id and refresh data JSONB
      const { error: updateErr } = await supabase
        .from("accounting_mirror")
        .update({
          customer_id: customer.id,
          data: inv,
          last_synced_at: new Date().toISOString(),
        })
        .eq("quickbooks_id", inv.Id)
        .eq("entity_type", "Invoice");

      if (updateErr) {
        details.push({ qbId: inv.Id, error: updateErr.message });
      } else {
        linked++;
        details.push({ qbId: inv.Id, customerId: customer.id, status: "linked" });
      }
    }

    console.log(`relink-orphan-invoices: ${linked} linked, ${notFound} unmatched, ${invoices.length} fetched from QB`);

    return new Response(
      JSON.stringify({ linked, notFound, totalFetched: invoices.length, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("relink-orphan-invoices error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
