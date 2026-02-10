import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIME_LIMIT_MS = 50_000;

const ODOO_STATUS_MAP: Record<string, string> = {
  draft: "Draft Quotation",
  sent: "Quotation Sent",
  sale: "Sales Order",
  cancel: "Cancelled",
};

interface OdooSession { uid: number; url: string }

async function odooAuthenticate(): Promise<OdooSession> {
  const rawUrl = Deno.env.get("ODOO_URL")!;
  const url = new URL(rawUrl.trim()).origin;
  const db = Deno.env.get("ODOO_DATABASE")!;
  const login = Deno.env.get("ODOO_USERNAME")!;
  const apiKey = Deno.env.get("ODOO_API_KEY")!;

  const xmlBody = `<?xml version="1.0"?>
<methodCall>
  <methodName>authenticate</methodName>
  <params>
    <param><value><string>${db}</string></value></param>
    <param><value><string>${login}</string></value></param>
    <param><value><string>${apiKey}</string></value></param>
    <param><value><struct></struct></value></param>
  </params>
</methodCall>`;

  const res = await fetch(`${url}/xmlrpc/2/common`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body: xmlBody,
  });
  const text = await res.text();
  const uidMatch = text.match(/<value><int>(\d+)<\/int><\/value>/);
  if (!uidMatch) {
    const fault = text.match(/<value><string>([^<]+)<\/string><\/value>/);
    throw new Error(`Odoo auth failed: ${fault?.[1] || text.slice(0, 300)}`);
  }
  return { uid: parseInt(uidMatch[1]), url };
}

async function odooSearchRead(
  session: OdooSession,
  model: string,
  fields: string[],
  domain: unknown[] = [],
  limit = 0,
  offset = 0,
): Promise<unknown[]> {
  const apiKey = Deno.env.get("ODOO_API_KEY")!;
  const db = Deno.env.get("ODOO_DATABASE")!;

  const res = await fetch(`${session.url}/jsonrpc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      id: Date.now(),
      params: {
        service: "object",
        method: "execute_kw",
        args: [
          db, session.uid, apiKey, model, "search_read",
          [domain],
          { fields, limit: limit || false, offset },
        ],
      },
    }),
  });

  if (!res.ok) throw new Error(`Odoo ${model} HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Odoo ${model} error: ${JSON.stringify(json.error)}`);
  return json.result || [];
}

async function loadExistingOdooIds(supabase: ReturnType<typeof createClient>): Promise<Set<number>> {
  const ids = new Set<number>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from("quotes")
      .select("odoo_id")
      .not("odoo_id", "is", null)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) if (r.odoo_id) ids.add(r.odoo_id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

async function loadCustomerMap(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .eq("company_id", companyId)
      .range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const c of data) map.set(c.name.toLowerCase(), c.id);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

async function getNextQuoteNumber(supabase: ReturnType<typeof createClient>): Promise<number> {
  const { data } = await supabase
    .from("quotes")
    .select("quote_number")
    .like("quote_number", "Q%")
    .order("created_at", { ascending: false })
    .limit(200);
  let maxNum = 0;
  for (const q of data || []) {
    const match = q.quote_number.match(/^Q(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return maxNum + 1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "No company found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyId = profile.company_id;
    const session = await odooAuthenticate();

    const [existingIds, customerMap, currentNum] = await Promise.all([
      loadExistingOdooIds(supabaseAdmin),
      loadCustomerMap(supabaseAdmin, companyId),
      getNextQuoteNumber(supabaseAdmin),
    ]);
    console.log(`Pre-loaded ${existingIds.size} existing quote IDs, ${customerMap.size} customers`);

    const ODOO_PAGE = 500;
    let offset = 0;
    let synced = 0, skipped = 0, totalFetched = 0;
    let quoteNum = currentNum;
    let remaining = false;

    while (true) {
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        remaining = true;
        break;
      }

      const orders = await odooSearchRead(session, "sale.order", [
        "id", "name", "date_order", "partner_id", "user_id",
        "amount_total", "state", "validity_date", "note",
        "create_date", "write_date",
      ], [], ODOO_PAGE, offset) as Array<Record<string, unknown>>;

      if (!orders.length) break;
      totalFetched += orders.length;
      console.log(`Fetched page offset=${offset}, got ${orders.length} quotations`);

      const pageInserts: unknown[] = [];

      for (const order of orders) {
        if (Date.now() - startTime > TIME_LIMIT_MS) {
          remaining = true;
          break;
        }

        const odooId = order.id as number;
        if (existingIds.has(odooId)) {
          skipped++;
          continue;
        }

        const orderName = (order.name as string) || `SO-${odooId}`;
        const state = (order.state as string) || "draft";
        const displayStatus = ODOO_STATUS_MAP[state] || state;

        const partnerArr = order.partner_id as [number, string] | false;
        const customerName = partnerArr ? partnerArr[1] : null;

        const userArr = order.user_id as [number, string] | false;
        const salesperson = userArr ? userArr[1] : null;

        const amount = (order.amount_total as number) || 0;
        const dateOrder = (order.date_order as string) || null;
        const validityDate = (order.validity_date as string) || null;
        const note = (order.note as string) || null;

        // Resolve customer
        let customerId: string | null = null;
        if (customerName) {
          const key = customerName.toLowerCase();
          if (customerMap.has(key)) {
            customerId = customerMap.get(key)!;
          }
        }

        const quoteNumber = orderName; // Use Odoo's SO number directly

        pageInserts.push({
          quote_number: quoteNumber,
          customer_id: customerId,
          status: state,
          total_amount: amount,
          valid_until: validityDate ? new Date(validityDate).toISOString() : null,
          notes: note,
          salesperson,
          odoo_id: odooId,
          odoo_status: displayStatus,
          source: "odoo_sync",
          company_id: companyId,
          metadata: {
            odoo_name: orderName,
            odoo_state: state,
            odoo_customer: customerName,
            odoo_salesperson: salesperson,
            odoo_date_order: dateOrder,
            synced_at: new Date().toISOString(),
          },
        });

        existingIds.add(odooId);
        quoteNum++;
      }

      // Batch insert in chunks of 50
      for (let i = 0; i < pageInserts.length; i += 50) {
        const chunk = pageInserts.slice(i, i + 50);
        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("quotes")
          .insert(chunk)
          .select("id");

        if (insertErr) {
          console.error("Batch insert error:", insertErr.message);
          for (const item of chunk) {
            const { error: singleErr } = await supabaseAdmin.from("quotes").insert(item);
            if (!singleErr) synced++;
            else console.error("Single insert fail:", singleErr.message);
          }
        } else {
          synced += (inserted?.length || 0);
        }
      }

      if (remaining) break;
      if (orders.length < ODOO_PAGE) break;
      offset += ODOO_PAGE;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Quotation sync done in ${elapsed}s: ${synced} new, ${skipped} skipped, ${totalFetched} fetched`);

    return new Response(
      JSON.stringify({ synced, skipped, total: totalFetched, remaining, elapsed_s: parseFloat(elapsed) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("sync-odoo-quotations error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
