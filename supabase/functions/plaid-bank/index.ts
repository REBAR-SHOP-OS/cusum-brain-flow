import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encryptToken, decryptToken } from "../_shared/tokenEncryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PLAID_ENV = Deno.env.get("PLAID_ENVIRONMENT") || "sandbox";
const PLAID_BASE = PLAID_ENV === "production"
  ? "https://production.plaid.com"
  : PLAID_ENV === "development"
    ? "https://development.plaid.com"
    : "https://sandbox.plaid.com";

function getPlaidCredentials() {
  const clientId = Deno.env.get("PLAID_CLIENT_ID");
  const secret = Deno.env.get("PLAID_SECRET");
  if (!clientId || !secret) throw new Error("Plaid credentials not configured");
  return { clientId, secret };
}

async function plaidRequest(path: string, body: Record<string, unknown>) {
  const { clientId, secret } = getPlaidCredentials();
  const res = await fetch(`${PLAID_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("Plaid API error:", JSON.stringify(data));
    throw new Error(data?.error_message || `Plaid error: ${res.status}`);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: accept either user JWT or service role
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { action, ...params } = await req.json();

    // Resolve user + company
    const { data: { user } } = await userClient.auth.getUser();

    switch (action) {
      case "create-link-token": {
        if (!user) throw new Error("Authentication required");
        const data = await plaidRequest("/link/token/create", {
          user: { client_user_id: user.id },
          client_name: "Rebar Shop OS",
          products: ["transactions"],
          country_codes: ["CA", "US"],
          language: "en",
        });
        return json({ link_token: data.link_token });
      }

      case "exchange-token": {
        if (!user) throw new Error("Authentication required");
        const { public_token, company_id } = params;
        if (!public_token || !company_id) throw new Error("Missing public_token or company_id");

        // Exchange public token for access token
        const exchangeData = await plaidRequest("/item/public_token/exchange", {
          public_token,
        });

        const accessToken = exchangeData.access_token;
        const itemId = exchangeData.item_id;

        // Encrypt the access token at rest
        const encryptedToken = await encryptToken(accessToken);

        // Get account details
        const accountsData = await plaidRequest("/accounts/get", {
          access_token: accessToken,
        });

        const accounts = accountsData.accounts || [];
        const rows = accounts.map((acct: any) => ({
          company_id,
          institution_name: params.institution_name || "Bank",
          plaid_item_id: itemId,
          access_token_encrypted: encryptedToken,
          account_mask: acct.mask,
          account_name: acct.name || acct.official_name || "Account",
          account_type: acct.subtype || acct.type || "depository",
          plaid_account_id: acct.account_id,
          status: "active",
          last_balance: acct.balances?.current ?? null,
          last_balance_sync: new Date().toISOString(),
        }));

        const { error } = await adminClient.from("bank_connections").insert(rows);
        if (error) throw new Error(`Failed to save connections: ${error.message}`);

        return json({ success: true, accounts_linked: rows.length });
      }

      case "get-balances": {
        if (!user) throw new Error("Authentication required");
        const { company_id } = params;
        if (!company_id) throw new Error("Missing company_id");

        const { data: connections } = await adminClient
          .from("bank_connections")
          .select("*")
          .eq("company_id", company_id)
          .eq("status", "active");

        if (!connections?.length) return json({ balances: [] });

        // Group by item (same access token)
        const itemMap = new Map<string, { token: string; connections: any[] }>();
        for (const conn of connections) {
          if (!itemMap.has(conn.plaid_item_id)) {
            const decrypted = await decryptToken(conn.access_token_encrypted);
            itemMap.set(conn.plaid_item_id, { token: decrypted, connections: [] });
          }
          itemMap.get(conn.plaid_item_id)!.connections.push(conn);
        }

        const results: any[] = [];
        for (const [_itemId, { token, connections: conns }] of itemMap) {
          const data = await plaidRequest("/accounts/balance/get", {
            access_token: token,
          });
          for (const acct of data.accounts || []) {
            const match = conns.find((c: any) => c.plaid_account_id === acct.account_id);
            if (match) {
              results.push({
                connection_id: match.id,
                account_name: match.account_name,
                current: acct.balances.current,
                available: acct.balances.available,
                mask: match.account_mask,
                linked_qb_account_id: match.linked_qb_account_id,
              });
              // Update stored balance
              await adminClient.from("bank_connections").update({
                last_balance: acct.balances.current,
                last_balance_sync: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }).eq("id", match.id);
            }
          }
        }

        return json({ balances: results });
      }

      case "sync-balances": {
        // Cron action — syncs all active connections and updates bank_feed_balances
        const { company_id } = params;

        let query = adminClient
          .from("bank_connections")
          .select("*")
          .eq("status", "active");
        if (company_id) query = query.eq("company_id", company_id);

        const { data: connections } = await query;
        if (!connections?.length) return json({ synced: 0 });

        const itemMap = new Map<string, { token: string; connections: any[] }>();
        for (const conn of connections) {
          if (!itemMap.has(conn.plaid_item_id)) {
            const decrypted = await decryptToken(conn.access_token_encrypted);
            itemMap.set(conn.plaid_item_id, { token: decrypted, connections: [] });
          }
          itemMap.get(conn.plaid_item_id)!.connections.push(conn);
        }

        let synced = 0;
        for (const [_itemId, { token, connections: conns }] of itemMap) {
          try {
            const data = await plaidRequest("/accounts/balance/get", {
              access_token: token,
            });
            for (const acct of data.accounts || []) {
              const match = conns.find((c: any) => c.plaid_account_id === acct.account_id);
              if (!match) continue;

              const balance = acct.balances.current;

              // Update bank_connections
              await adminClient.from("bank_connections").update({
                last_balance: balance,
                last_balance_sync: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }).eq("id", match.id);

              // If linked to a QB account, also update qb_bank_activity.bank_balance
              if (match.linked_qb_account_id) {
                await adminClient.from("qb_bank_activity").update({
                  bank_balance: balance,
                  updated_at: new Date().toISOString(),
                }).eq("company_id", match.company_id)
                  .eq("qb_account_id", match.linked_qb_account_id);
              }

              synced++;
            }
          } catch (err) {
            console.error(`Failed to sync item ${_itemId}:`, err);
          }
        }

        return json({ synced });
      }

      case "get-transactions": {
        if (!user) throw new Error("Authentication required");
        const { company_id, start_date, end_date } = params;
        if (!company_id) throw new Error("Missing company_id");

        const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const endDate = end_date || new Date().toISOString().slice(0, 10);

        const { data: connections } = await adminClient
          .from("bank_connections")
          .select("*")
          .eq("company_id", company_id)
          .eq("status", "active");

        if (!connections?.length) return json({ transactions: [] });

        const allTxns: any[] = [];
        const itemMap = new Map<string, string>();
        for (const conn of connections) {
          if (!itemMap.has(conn.plaid_item_id)) {
            itemMap.set(conn.plaid_item_id, await decryptToken(conn.access_token_encrypted));
          }
        }

        for (const [_itemId, token] of itemMap) {
          const data = await plaidRequest("/transactions/get", {
            access_token: token,
            start_date: startDate,
            end_date: endDate,
            options: { count: 500 },
          });
          for (const txn of data.transactions || []) {
            const conn = connections.find((c: any) => c.plaid_account_id === txn.account_id);
            if (!conn) continue;

            allTxns.push({
              company_id,
              connection_id: conn.id,
              plaid_txn_id: txn.transaction_id,
              date: txn.date,
              description: txn.name || txn.merchant_name || "",
              amount: txn.amount,
              category: txn.personal_finance_category?.primary || txn.category?.[0] || null,
              pending: txn.pending || false,
            });
          }
        }

        // Upsert into bank_transactions_live
        if (allTxns.length > 0) {
          await adminClient.from("bank_transactions_live").upsert(allTxns, {
            onConflict: "plaid_txn_id",
          });
        }

        return json({ transactions: allTxns, count: allTxns.length });
      }

      case "link-to-qb": {
        if (!user) throw new Error("Authentication required");
        const { connection_id, qb_account_id } = params;
        if (!connection_id || !qb_account_id) throw new Error("Missing connection_id or qb_account_id");

        const { error } = await adminClient
          .from("bank_connections")
          .update({
            linked_qb_account_id: qb_account_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection_id);

        if (error) throw new Error(error.message);
        return json({ success: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("plaid-bank error:", err);
    return json({ error: err.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
