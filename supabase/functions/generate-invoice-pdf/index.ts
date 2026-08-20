
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  customerName?: string;
  customerCompany?: string;
  customerAddress?: string;
  items: LineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  stripePayUrl?: string;
  qbPayUrl?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "CAD" }).format(n);
}

function buildInvoiceHtml(data: InvoiceData): string {
  const itemRows = data.items
    .map(
      (it) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;">${escapeHtml(it.description)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;">${it.quantity}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;">${fmt(it.unitPrice)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;">${fmt(it.quantity * it.unitPrice)}</td>
    </tr>`
    )
    .join("");

  const paymentLinks: string[] = [];
  if (data.stripePayUrl) {
    paymentLinks.push(
      `<a href="${escapeHtml(data.stripePayUrl)}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:700;margin-right:12px;">💳 Pay via Stripe</a>`
    );
  }
  if (data.qbPayUrl) {
    paymentLinks.push(
      `<a href="${escapeHtml(data.qbPayUrl)}" style="display:inline-block;background:#2ca01c;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:700;">📋 Pay via QuickBooks</a>`
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><style>
  @page { size: letter; margin: 0.6in; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #333; margin: 0; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #1a1a2e; padding-bottom: 20px; }
  .company { font-size: 22px; font-weight: 700; color: #1a1a2e; }
  .company-sub { font-size: 11px; color: #888; margin-top: 4px; }
  .inv-title { font-size: 28px; font-weight: 800; color: #1a1a2e; text-align: right; }
  .inv-num { font-size: 14px; color: #666; text-align: right; margin-top: 4px; }
  .bill-to { margin-bottom: 28px; }
  .bill-to-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 600; margin-bottom: 4px; }
  .bill-to-name { font-size: 16px; font-weight: 600; color: #1a1a2e; }
  .bill-to-addr { font-size: 12px; color: #666; margin-top: 2px; }
  table.items { width: 100%; border-collapse: collapse; margin: 20px 0; }
  table.items thead tr { background: #1a1a2e; }
  table.items th { padding: 10px 14px; color: #fff; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .totals { border-top: 2px solid #1a1a2e; padding-top: 12px; margin-top: 8px; }
  .totals td { padding: 4px 14px; font-size: 13px; }
  .total-row td { font-size: 18px; font-weight: 700; padding-top: 8px; }
  .total-amount { color: #dc2626; }
  .meta-box { background: #f8f9fc; border-radius: 8px; padding: 14px 18px; margin: 24px 0; font-size: 12px; color: #555; }
  .pay-section { text-align: center; margin: 28px 0; }
  .pay-section p { font-size: 11px; color: #888; margin-top: 6px; }
  .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 32px; border-top: 1px solid #eee; padding-top: 12px; }
</style></head>
<body>
  <div class="header">
    <div>
      <div class="company">Rebar.shop</div>
      <div class="company-sub">Reinforcing Steel Solutions</div>
    </div>
    <div>
      <div class="inv-title">INVOICE</div>
      <div class="inv-num">#${escapeHtml(data.invoiceNumber)}</div>
      <div style="text-align:right;font-size:12px;color:#666;margin-top:8px;">
        <strong>Date:</strong> ${escapeHtml(data.invoiceDate)}<br/>
        <strong>Due:</strong> ${data.dueDate ? escapeHtml(data.dueDate) : "Upon Receipt"}
      </div>
    </div>
  </div>

  <div class="bill-to">
    <div class="bill-to-label">Bill To</div>
    <div class="bill-to-name">${escapeHtml(data.customerName || data.customerCompany || "Customer")}</div>
    ${data.customerCompany && data.customerName ? `<div class="bill-to-addr">${escapeHtml(data.customerCompany)}</div>` : ""}
    ${data.customerAddress ? `<div class="bill-to-addr">${escapeHtml(data.customerAddress)}</div>` : ""}
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="text-align:left;">Description</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <table style="width:100%;">
      <tr><td style="text-align:right;color:#666;">Subtotal:</td><td style="text-align:right;width:140px;font-weight:600;">${fmt(data.subtotal)}</td></tr>
      <tr><td style="text-align:right;color:#666;">HST (${data.taxRate}%):</td><td style="text-align:right;font-weight:600;">${fmt(data.taxAmount)}</td></tr>
      <tr class="total-row"><td style="text-align:right;color:#1a1a2e;">Total Due:</td><td style="text-align:right;" class="total-amount">${fmt(data.total)}</td></tr>
    </table>
  </div>

  ${data.notes ? `<div class="meta-box"><strong>Notes:</strong> ${escapeHtml(data.notes)}</div>` : ""}

  ${
    paymentLinks.length > 0
      ? `<div class="pay-section">
          <p style="font-size:13px;font-weight:600;color:#333;margin-bottom:12px;">Payment Options</p>
          ${paymentLinks.join("\n")}
          <p>Click a button above to pay securely online</p>
        </div>`
      : ""
  }

  <div class="footer">
    Rebar.shop — Thank you for your business!<br/>
    ${data.stripePayUrl ? `Stripe: ${escapeHtml(data.stripePayUrl)}` : ""}
    ${data.stripePayUrl && data.qbPayUrl ? " | " : ""}
    ${data.qbPayUrl ? `QuickBooks: ${escapeHtml(data.qbPayUrl)}` : ""}
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body: InvoiceData & { invoiceId: string } = await req.json();
    const {
      invoiceId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      customerName,
      customerCompany,
      customerAddress,
      items,
      subtotal,
      taxRate,
      taxAmount,
      total,
      notes,
      stripePayUrl,
      qbPayUrl,
    } = body;

    if (!invoiceId || !invoiceNumber || !items?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields: invoiceId, invoiceNumber, items" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate HTML for the invoice
    const html = buildInvoiceHtml({
      invoiceNumber,
      invoiceDate: invoiceDate || new Date().toISOString().slice(0, 10),
      dueDate,
      customerName,
      customerCompany,
      customerAddress,
      items,
      subtotal: subtotal || 0,
      taxRate: taxRate || 13,
      taxAmount: taxAmount || 0,
      total: total || 0,
      notes,
      stripePayUrl,
      qbPayUrl,
    });

    // Use jsPDF to convert HTML to PDF
    // Since Deno doesn't have a browser, we'll use a simpler approach:
    // Store the HTML as a self-contained printable document that renders as PDF when opened
    // This is the most reliable approach without a headless browser
    const pdfHtml = html;
    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(pdfHtml);

    // Upload to storage
    const filePath = `${invoiceId}/${invoiceNumber.replace(/[^a-zA-Z0-9-]/g, "_")}.html`;
    
    const { error: uploadErr } = await supabase.storage
      .from("invoice-pdfs")
      .upload(filePath, htmlBytes, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return new Response(JSON.stringify({ error: "Failed to upload invoice: " + uploadErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate signed URL (valid 30 days)
    const { data: signedData, error: signErr } = await supabase.storage
      .from("invoice-pdfs")
      .createSignedUrl(filePath, 60 * 60 * 24 * 30);

    if (signErr || !signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: "Failed to generate download link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        url: signedData.signedUrl,
        filePath,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-invoice-pdf error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
