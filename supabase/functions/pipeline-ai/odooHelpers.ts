// Odoo read-only helpers for pipeline-ai
// Reuses the proven XML-RPC auth + JSON-RPC query pattern from sync-odoo-leads

export interface OdooSession {
  uid: number;
  url: string;
}

export async function odooAuthenticate(): Promise<OdooSession> {
  const rawUrl = Deno.env.get("ODOO_URL");
  const db = Deno.env.get("ODOO_DATABASE");
  const login = Deno.env.get("ODOO_USERNAME");
  const apiKey = Deno.env.get("ODOO_API_KEY");

  if (!rawUrl || !db || !login || !apiKey) {
    throw new Error("Odoo credentials not configured");
  }

  const url = new URL(rawUrl.trim()).origin;

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

export async function odooSearchRead(
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

/**
 * Fetch a snapshot of live Odoo data for AI context.
 * Returns a formatted string to inject into the system prompt.
 */
export async function fetchOdooSnapshot(): Promise<string> {
  try {
    const session = await odooAuthenticate();

    const [leads, orders] = await Promise.all([
      odooSearchRead(
        session,
        "crm.lead",
        [
          "id", "name", "stage_id", "partner_id", "contact_name",
          "email_from", "phone", "expected_revenue", "probability",
          "date_deadline", "user_id", "priority", "create_date",
          "write_date", "type",
        ],
        [["active", "=", true]],
        500,
      ),
      odooSearchRead(
        session,
        "sale.order",
        [
          "id", "name", "partner_id", "amount_total", "state",
          "date_order", "user_id", "validity_date",
        ],
        [],
        200,
      ),
    ]);

    const leadsJson = JSON.stringify(leads, null, 1);
    const ordersJson = JSON.stringify(orders, null, 1);

    return `
═══ ODOO LIVE DATA (real-time) ═══

OPPORTUNITIES (${(leads as any[]).length} records):
${leadsJson}

QUOTATIONS / SALE ORDERS (${(orders as any[]).length} records):
${ordersJson}

Use this data to answer questions about specific leads, salespersons, quotation amounts, stages, and pipeline health. Reference leads by name, partner, and salesperson when possible.`;
  } catch (err: any) {
    console.error("Odoo snapshot fetch failed:", err.message);
    return `\n[Odoo live data unavailable: ${err.message}]\n`;
  }
}
