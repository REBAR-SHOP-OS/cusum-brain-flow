import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { buildBrandedEmail, fetchActorSignature } from "../_shared/brandedEmail.ts";
import { decryptToken } from "../_shared/tokenEncryption.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sendSchema = z.object({
  quote_id: z.string().uuid(),
  customer_email: z.string().email().optional().or(z.literal("")),
  action: z.enum(["send_quote", "convert_to_invoice", "accept_and_convert", "send_quote_copy"]),
});

const APP_URL = "https://cusum-brain-flow.lovable.app";

/**
 * Send an email directly via Gmail API using any available sender from user_gmail_tokens.
 * Used for public/unauthenticated flows (accept_and_convert, send_quote_copy)
 * where there is no logged-in user context.
 */
async function sendEmailDirectViaGmail(
  svc: ReturnType<typeof createClient>,
  to: string,
  subject: string,
  bodyHtml: string
): Promise<boolean> {
  // Find first available Gmail sender
  const { data: tokenRow } = await svc
    .from("user_gmail_tokens")
    .select("user_id, refresh_token, is_encrypted")
    .limit(1)
    .maybeSingle();

  if (!tokenRow?.refresh_token) {
    console.error("[sendEmailDirectViaGmail] No Gmail tokens found in user_gmail_tokens");
    return false;
  }

  let refreshToken = tokenRow.refresh_token;
  if (tokenRow.is_encrypted) {
    refreshToken = await decryptToken(refreshToken);
  }

  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.error("[sendEmailDirectViaGmail] Gmail OAuth credentials not configured");
    return false;
  }

  // Refresh access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    console.error("[sendEmailDirectViaGmail] Token refresh failed:", await tokenRes.text());
    return false;
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // Get sender email
  const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) {
    console.error("[sendEmailDirectViaGmail] Failed to get Gmail profile");
    return false;
  }
  const profile = await profileRes.json();
  const fromEmail = profile.emailAddress;

  // Build raw email
  const emailLines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    bodyHtml,
  ];
  const email = emailLines.join("\r\n");
  const base64 = btoa(unescape(encodeURIComponent(email)));
  const raw = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  // Send
  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });

  if (!sendRes.ok) {
    console.error("[sendEmailDirectViaGmail] Gmail send failed:", await sendRes.text());
    return false;
  }

  console.log(`[sendEmailDirectViaGmail] Email sent to ${to} from ${fromEmail}`);
  return true;
}

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: svc, body: rawBody } = ctx;

    const parsed = sendSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { quote_id, customer_email: rawEmail, action } = parsed.data;
    const customer_email = rawEmail || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    console.log(`[send-quote-email] action=${action}, quote_id=${quote_id}, hasEmail=${!!rawEmail}`);

    // Fetch quote data
    const { data: quote, error: qErr } = await svc
      .from("quotes")
      .select("*")
      .eq("id", quote_id)
      .single();

    if (qErr || !quote) {
      throw new Error(qErr?.message || "Quote not found");
    }

    const meta = (quote.metadata || {}) as Record<string, any>;
    const quoteNumber = quote.quote_number || "DRAFT";
    const customerName = meta.customer_name || "Valued Customer";
    const lineItems = Array.isArray(meta.line_items) ? meta.line_items : [];
    const notes = meta.notes || "";
    const totalAmount = quote.total_amount || 0;
    const taxRate = meta.tax_rate ?? 13;
    const subtotal = Math.round((totalAmount / (1 + taxRate / 100)) * 100) / 100;
    const taxAmount = Math.round((totalAmount - subtotal) * 100) / 100;

    // Build line items HTML
    const lineItemsHtml = lineItems.length > 0
      ? lineItems.map((li: any) => {
          const qty = Number(li.quantity) || 0;
          const price = Number(li.unitPrice ?? li.unit_price) || 0;
          const amount = qty * price;
          return `<tr>
            <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#333;">${li.description || ""}</td>
            <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#333;text-align:right;">${qty}</td>
            <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#333;text-align:right;">$${price.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</td>
            <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#333;text-align:right;font-weight:600;">$${amount.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</td>
          </tr>`;
        }).join("")
      : "";

    const lineItemsTable = lineItemsHtml
      ? `<table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <thead><tr>
            <th style="text-align:left;padding:10px 14px;background:#f1f3f9;color:#555;font-size:12px;border-bottom:2px solid #e5e7eb;">Description</th>
            <th style="text-align:right;padding:10px 14px;background:#f1f3f9;color:#555;font-size:12px;border-bottom:2px solid #e5e7eb;">Qty</th>
            <th style="text-align:right;padding:10px 14px;background:#f1f3f9;color:#555;font-size:12px;border-bottom:2px solid #e5e7eb;">Unit Price</th>
            <th style="text-align:right;padding:10px 14px;background:#f1f3f9;color:#555;font-size:12px;border-bottom:2px solid #e5e7eb;">Amount</th>
          </tr></thead>
          <tbody>${lineItemsHtml}</tbody>
          <tfoot>
            <tr><td colspan="3" style="text-align:right;padding:8px 14px;font-size:13px;color:#888;">Subtotal:</td><td style="text-align:right;padding:8px 14px;font-size:13px;font-weight:600;">$${subtotal.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</td></tr>
            <tr><td colspan="3" style="text-align:right;padding:8px 14px;font-size:13px;color:#888;">HST (${taxRate}%):</td><td style="text-align:right;padding:8px 14px;font-size:13px;">$${taxAmount.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</td></tr>
            <tr><td colspan="3" style="text-align:right;padding:8px 14px;font-size:15px;font-weight:700;color:#1a1a2e;">Total:</td><td style="text-align:right;padding:8px 14px;font-size:15px;font-weight:700;color:#e94560;">$${totalAmount.toLocaleString("en-CA", { minimumFractionDigits: 2 })} CAD</td></tr>
          </tfoot>
        </table>`
      : `<div style="background:#f8f9fc;border-radius:8px;padding:20px;margin:24px 0;border-left:4px solid #e94560;">
          <p style="font-size:22px;font-weight:700;color:#e94560;margin:0;">$${totalAmount.toLocaleString("en-CA", { minimumFractionDigits: 2 })} CAD</p>
        </div>`;

    // Get actor signature
    const sigHtml = await fetchActorSignature(svc, userId);

    // Get auth header for internal function calls
    const authHeader = req.headers.get("Authorization") || "";

    if (action === "send_quote") {
      // ── Send Quotation Email ──
      const bodyHtml = `
        <p style="font-size:16px;color:#333;">Dear ${customerName},</p>
        <p style="font-size:14px;color:#555;line-height:1.6;">Please find your quotation below. We look forward to working with you.</p>
        <div style="background:#f8f9fc;border-radius:8px;padding:16px;margin:20px 0;border-left:4px solid #e94560;">
          <table style="width:100%;">
            <tr><td style="color:#888;font-size:13px;padding:4px 0;">Quotation #</td><td style="text-align:right;font-weight:600;color:#1a1a2e;">${quoteNumber}</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:4px 0;">Total Amount</td><td style="text-align:right;font-weight:700;color:#e94560;font-size:20px;">$${totalAmount.toLocaleString("en-CA", { minimumFractionDigits: 2 })} CAD</td></tr>
            ${quote.valid_until ? `<tr><td style="color:#888;font-size:13px;padding:4px 0;">Valid Until</td><td style="text-align:right;color:#1a1a2e;">${new Date(quote.valid_until).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</td></tr>` : ""}
          </table>
        </div>
        ${lineItemsTable}
        ${notes ? `<div style="margin-top:20px;padding:16px;background:#fafafa;border-radius:6px;border:1px solid #e5e7eb;"><p style="font-size:12px;color:#888;margin:0 0 8px;font-weight:600;">Notes / Terms:</p><pre style="font-size:12px;color:#555;margin:0;white-space:pre-wrap;font-family:inherit;">${notes}</pre></div>` : ""}
        <div style="text-align:center;margin:32px 0;">
          <a href="${APP_URL}/accept-quote/${quote_id}" style="display:inline-block;background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:8px;font-size:18px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(34,197,94,0.4);">✅ Review & Accept Quote</a>
          <p style="color:#888;font-size:12px;margin-top:10px;">Click to review terms and confirm your order</p>
        </div>
        <p style="font-size:14px;color:#555;margin-top:24px;">If you have any questions, please don't hesitate to reach out.</p>
      `;

      const brandedHtml = buildBrandedEmail({
        bodyHtml,
      });

      // Send via gmail-send
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
        body: JSON.stringify({
          to: customer_email,
          subject: `Quotation ${quoteNumber} - REBAR.SHOP`,
          body: brandedHtml,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        throw new Error(`Email send failed: ${errText}`);
      }

      // Update quote status and persist customer_email in metadata
      await svc.from("quotes").update({
        status: "sent",
        metadata: { ...meta, customer_email: customer_email },
      } as any).eq("id", quote_id);

      // Also update sales_quotations if linked
      const { data: sq } = await svc
        .from("sales_quotations")
        .select("id, status")
        .eq("quote_id", quote_id)
        .maybeSingle();

      if (sq && !["sent_to_customer", "customer_approved"].includes(sq.status)) {
        await svc.from("sales_quotations").update({ status: "sent_to_customer", customer_email: customer_email } as any).eq("id", sq.id);
      }

      return { success: true, message: `Quotation ${quoteNumber} sent to ${customer_email}` };
    }

    if (action === "convert_to_invoice") {
      // ── Convert to Invoice ──

      // 1. Fetch linked sales_quotation
      const { data: sq } = await svc
        .from("sales_quotations")
        .select("*")
        .eq("quote_id", quote_id)
        .maybeSingle();

      const companyId = sq?.company_id || quote.company_id || "a0000000-0000-0000-0000-000000000001";
      const amount = sq?.amount || totalAmount;

      // 2. Generate invoice number
      const year = new Date().getFullYear();
      const { data: latestInv } = await svc
        .from("sales_invoices")
        .select("invoice_number")
        .like("invoice_number", `INV-${year}%`)
        .order("invoice_number", { ascending: false })
        .limit(1);

      let invSeq = 1;
      if (latestInv && latestInv.length > 0) {
        const lastNum = parseInt(latestInv[0].invoice_number.replace(`INV-${year}`, ""), 10);
        if (!isNaN(lastNum)) invSeq = lastNum + 1;
      }
      const invoiceNumber = `INV-${year}${String(invSeq).padStart(4, "0")}`;

      const issuedDate = new Date().toISOString().split("T")[0];
      const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

      // 3. Create invoice
      const { data: newInvoice, error: invErr } = await svc
        .from("sales_invoices")
        .insert({
          company_id: companyId,
          invoice_number: invoiceNumber,
          quotation_id: sq?.id || null,
          customer_name: sq?.customer_name || customerName,
          customer_company: sq?.customer_company || null,
          amount,
          status: "sent",
          issued_date: issuedDate,
          due_date: dueDate,
          notes: sq?.notes || notes || null,
          sales_lead_id: sq?.lead_id || null,
        })
        .select()
        .single();

      if (invErr) throw new Error(`Invoice creation failed: ${invErr.message}`);

      // 4. Generate Stripe payment link
      let stripePaymentUrl = "";
      try {
        const stripeRes = await fetch(`${supabaseUrl}/functions/v1/stripe-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({
            action: "create-payment-link",
            amount,
            currency: "cad",
            invoiceNumber,
            customerName: sq?.customer_name || customerName,
            qbInvoiceId: newInvoice.id,
          }),
        });
        if (stripeRes.ok) {
          const stripeData = await stripeRes.json();
          stripePaymentUrl = stripeData.paymentLink?.stripe_url || "";
        } else {
          console.warn("Stripe payment link failed:", await stripeRes.text());
        }
      } catch (e) {
        console.warn("Stripe error:", e);
      }

      // 5. Build invoice email
      const payNowButton = stripePaymentUrl
        ? `<div style="text-align:center;margin:32px 0;">
            <a href="${stripePaymentUrl}" style="display:inline-block;background:linear-gradient(135deg,#e94560 0%,#c23152 100%);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:8px;font-size:18px;font-weight:700;letter-spacing:1px;box-shadow:0 4px 14px rgba(233,69,96,0.4);">💳 Pay Now</a>
            <p style="color:#888;font-size:12px;margin-top:10px;">Secure payment powered by Stripe</p>
           </div>`
        : "";

      const invoiceBodyHtml = `
        <p style="font-size:16px;color:#333;">Dear ${customerName},</p>
        <p style="font-size:15px;color:#555;line-height:1.6;">Thank you for confirming your order. Please find your invoice below.</p>
        <div style="background:#f8f9fc;border-radius:8px;padding:20px;margin:24px 0;border-left:4px solid #e94560;">
          <table style="width:100%;">
            <tr><td style="color:#888;font-size:13px;padding:4px 0;">Invoice #</td><td style="text-align:right;font-weight:600;color:#1a1a2e;">${invoiceNumber}</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:4px 0;">Amount Due</td><td style="text-align:right;font-weight:700;color:#e94560;font-size:22px;">$${amount.toLocaleString("en-CA", { minimumFractionDigits: 2 })} CAD</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:4px 0;">Issue Date</td><td style="text-align:right;color:#1a1a2e;">${issuedDate}</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:4px 0;">Due Date</td><td style="text-align:right;color:#1a1a2e;font-weight:600;">${dueDate}</td></tr>
          </table>
        </div>
        ${lineItemsTable}
        ${payNowButton}
        <p style="font-size:14px;color:#555;line-height:1.6;margin-top:24px;">
          All amounts are in Canadian Dollars (CAD). Payment is due by <strong>${dueDate}</strong>.
        </p>
      `;

      const brandedInvoiceHtml = buildBrandedEmail({
        bodyHtml: invoiceBodyHtml,
      });

      // 6. Send invoice email
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
        body: JSON.stringify({
          to: customer_email,
          subject: `Invoice ${invoiceNumber} - REBAR.SHOP`,
          body: brandedInvoiceHtml,
        }),
      });

      // 7. Update quotation status
      if (sq) {
        await svc.from("sales_quotations").update({
          status: "customer_approved",
          customer_approved_at: new Date().toISOString(),
          customer_email: customer_email,
        } as any).eq("id", sq.id);
      }
      await svc.from("quotes").update({ status: "accepted" } as any).eq("id", quote_id);

      const emailOk = emailRes.ok;
      if (!emailOk) {
        console.warn("Invoice email failed:", await emailRes.text());
      }

      return {
        success: true,
        invoice_id: newInvoice.id,
        invoice_number: invoiceNumber,
        payment_link: stripePaymentUrl || null,
        email_sent: emailOk,
        message: `Invoice ${invoiceNumber} created${emailOk ? ` and sent to ${customer_email}` : " (email failed)"}${stripePaymentUrl ? " with payment link" : ""}`,
      };
    }

    if (action === "accept_and_convert") {
      // ── Public acceptance: convert to invoice (no auth required) ──
      // Try to find linked sales_quotation by quotation_number
      const { data: sqCheck } = await svc
        .from("sales_quotations")
        .select("id, status, customer_name, customer_company, company_id, amount, lead_id, notes, customer_email, quotation_number")
        .eq("quotation_number", quoteNumber)
        .maybeSingle();

      const sqStatus = sqCheck?.status || "";
      const validStatuses = ["sent", "sent_to_customer", "accepted"];
      const quoteAccepted = quote.status === "accepted" || sqStatus === "customer_approved";

      if (!quoteAccepted && !validStatuses.includes(sqStatus) && !validStatuses.includes(quote.status || "")) {
        throw new Error("This quotation can no longer be accepted. It may have already been processed, expired, or cancelled.");
      }

      // Resolve customer email
      const resolvedEmail = customer_email || (meta.customer_email as string) || (sqCheck as any)?.customer_email || "";
      if (!resolvedEmail) {
        throw new Error("No customer email found for this quotation");
      }

      const companyId = sqCheck?.company_id || quote.company_id || "a0000000-0000-0000-0000-000000000001";
      // The quotation amount is TAX-INCLUSIVE. Store the pre-tax subtotal as invoice amount
      // so the invoice editor doesn't double-tax it.
      const rawTotalWithTax = sqCheck?.amount || totalAmount;
      const invoiceTaxRate = ((meta.tax_rate as number) ?? 13) / 100;
      const amount = Math.round((rawTotalWithTax / (1 + invoiceTaxRate)) * 100) / 100;

      // Check if invoice already exists (re-acceptance scenario)
      const { data: existingInvoice } = await svc
        .from("sales_invoices")
        .select("id, invoice_number, status")
        .eq("quotation_id", sqCheck?.id || "00000000-0000-0000-0000-000000000000")
        .maybeSingle();

      let invoiceNumber: string;
      let invoiceId: string;
      let stripePaymentUrl = "";

      if (existingInvoice) {
        // Re-acceptance: invoice already exists, just re-send email
        invoiceNumber = existingInvoice.invoice_number;
        invoiceId = existingInvoice.id;
        console.log(`[accept_and_convert] Re-acceptance: existing invoice ${invoiceNumber}`);

        // Try to find existing Stripe payment link
        try {
          const { data: paymentLink } = await svc
            .from("stripe_payment_links")
            .select("stripe_url")
            .eq("qb_invoice_id", invoiceId)
            .eq("status", "active")
            .maybeSingle();
          stripePaymentUrl = paymentLink?.stripe_url || "";
        } catch (_e) { /* no stripe_payment_links or no link */ }
      } else {
        // First acceptance: create invoice
        const year = new Date().getFullYear();
        const { data: latestInv } = await svc
          .from("sales_invoices")
          .select("invoice_number")
          .like("invoice_number", `INV-${year}%`)
          .order("invoice_number", { ascending: false })
          .limit(1);

        let invSeq = 1;
        if (latestInv && latestInv.length > 0) {
          const lastNum = parseInt(latestInv[0].invoice_number.replace(`INV-${year}`, ""), 10);
          if (!isNaN(lastNum)) invSeq = lastNum + 1;
        }
        invoiceNumber = `INV-${year}${String(invSeq).padStart(4, "0")}`;
        const issuedDate = new Date().toISOString().split("T")[0];
        const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

        const { data: newInvoice, error: invErr } = await svc
          .from("sales_invoices")
          .insert({
            company_id: companyId,
            invoice_number: invoiceNumber,
            quotation_id: sqCheck?.id || null,
            customer_name: sqCheck?.customer_name || customerName,
            customer_company: sqCheck?.customer_company || null,
            amount,
            status: "sent",
            issued_date: issuedDate,
            due_date: dueDate,
            notes: sqCheck?.notes || notes || null,
            sales_lead_id: sqCheck?.lead_id || null,
          })
          .select()
          .single();

        if (invErr) throw new Error(`Invoice creation failed: ${invErr.message}`);
        invoiceId = newInvoice.id;

        // Copy line items from quotation to invoice
        // PRIMARY SOURCE: quotes.metadata.line_items (always populated by DraftQuotationEditor & AI)
        // SECONDARY SOURCE: sales_quotation_items table (rarely populated)
        try {
          let itemsCopied = false;

          // 1. Primary: quotes.metadata.line_items
          const metaItems = (meta.line_items || meta.items || []) as any[];
          if (metaItems.length > 0) {
            const invoiceItems = metaItems.map((mi: any, idx: number) => {
              const qty = Number(mi.quantity) || Number(mi.qty) || 1;
              const price = Number(mi.unitPrice) || Number(mi.unit_price) || Number(mi.price) || 0;
              return {
                invoice_id: invoiceId,
                company_id: companyId,
                description: mi.description || mi.name || "Item",
                quantity: qty,
                unit: mi.unit || null,
                unit_price: price,
                total: qty * price,
                sort_order: idx,
              };
            });
            await svc.from("sales_invoice_items").insert(invoiceItems);
            console.log(`[accept_and_convert] Copied ${invoiceItems.length} line items from quotes.metadata`);
            itemsCopied = true;
          }

          // 2. Secondary: sales_quotation_items (if metadata was empty)
          if (!itemsCopied && sqCheck?.id) {
            const { data: quoteItems } = await svc
              .from("sales_quotation_items")
              .select("description, quantity, unit, unit_price, total, sort_order, company_id")
              .eq("quotation_id", sqCheck.id)
              .order("sort_order");
            if (quoteItems && quoteItems.length > 0) {
              const invoiceItems = quoteItems.map((qi: any) => ({
                invoice_id: invoiceId,
                company_id: qi.company_id || companyId,
                description: qi.description,
                quantity: qi.quantity,
                unit: qi.unit,
                unit_price: qi.unit_price,
                total: qi.total,
                sort_order: qi.sort_order,
              }));
              await svc.from("sales_invoice_items").insert(invoiceItems);
              console.log(`[accept_and_convert] Copied ${invoiceItems.length} line items from sales_quotation_items`);
              itemsCopied = true;
            }
          }

          if (!itemsCopied) {
            console.warn("[accept_and_convert] No line items found to copy — invoice will have header amount only");
          }
        } catch (itemErr) {
          console.warn("[accept_and_convert] Failed to copy line items:", itemErr);
        }

        // Generate Stripe payment link
        try {
          const stripeRes = await fetch(`${supabaseUrl}/functions/v1/stripe-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
            },
            body: JSON.stringify({
              action: "create-payment-link",
              amount: rawTotalWithTax,
              currency: "cad",
              invoiceNumber,
              customerName: sqCheck?.customer_name || customerName,
              qbInvoiceId: newInvoice.id,
            }),
          });
          if (stripeRes.ok) {
            const stripeData = await stripeRes.json();
            stripePaymentUrl = stripeData.paymentLink?.stripe_url || "";
          }
        } catch (_e) {
          console.warn("Stripe error:", _e);
        }

        // Update statuses
        if (sqCheck) {
          await svc.from("sales_quotations").update({
            status: "customer_approved",
            customer_approved_at: new Date().toISOString(),
          } as any).eq("id", sqCheck.id);
        }
        await svc.from("quotes").update({ status: "accepted" } as any).eq("id", quote_id);
      }

      // Build and send invoice email directly via Gmail API (no user auth needed)
      const issuedDate = new Date().toISOString().split("T")[0];
      const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

      // Rebuild line items from structured data (sales_quotation_items or sales_invoice_items)
      let emailLineItemsHtml = lineItemsTable; // fallback to metadata-based table
      let emailAmountDue = rawTotalWithTax; // always show tax-inclusive total to customer
      try {
        // Try invoice items first (just copied), then quotation items
        let structuredItems: any[] = [];
        const { data: invItems } = await svc
          .from("sales_invoice_items")
          .select("description, quantity, unit_price, total, sort_order")
          .eq("invoice_id", invoiceId)
          .order("sort_order");
        if (invItems && invItems.length > 0) {
          structuredItems = invItems;
        } else if (sqCheck?.id) {
          const { data: qItems } = await svc
            .from("sales_quotation_items")
            .select("description, quantity, unit_price, total, sort_order")
            .eq("quotation_id", sqCheck.id)
            .order("sort_order");
          if (qItems && qItems.length > 0) structuredItems = qItems;
        }

        if (structuredItems.length > 0) {
          const itemSubtotal = structuredItems.reduce((s: number, i: any) => s + (Number(i.total) || (Number(i.quantity) * Number(i.unit_price))), 0);
          const itemTaxRate = ((meta.tax_rate as number) ?? 13);
          const itemTax = Math.round(itemSubtotal * itemTaxRate) / 100;
          const itemTotal = itemSubtotal + itemTax;
          emailAmountDue = itemTotal;

          const rowsHtml = structuredItems.map((si: any) => {
            const qty = Number(si.quantity) || 0;
            const price = Number(si.unit_price) || 0;
            const lineTotal = Number(si.total) || qty * price;
            return `<tr>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#333;">${si.description || ""}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#333;text-align:right;">${qty}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#333;text-align:right;">$${price.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</td>
              <td style="padding:8px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#333;text-align:right;font-weight:600;">$${lineTotal.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</td>
            </tr>`;
          }).join("");

          emailLineItemsHtml = `<table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <thead><tr>
              <th style="text-align:left;padding:10px 14px;background:#f1f3f9;color:#555;font-size:12px;border-bottom:2px solid #e5e7eb;">Description</th>
              <th style="text-align:right;padding:10px 14px;background:#f1f3f9;color:#555;font-size:12px;border-bottom:2px solid #e5e7eb;">Qty</th>
              <th style="text-align:right;padding:10px 14px;background:#f1f3f9;color:#555;font-size:12px;border-bottom:2px solid #e5e7eb;">Unit Price</th>
              <th style="text-align:right;padding:10px 14px;background:#f1f3f9;color:#555;font-size:12px;border-bottom:2px solid #e5e7eb;">Amount</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr><td colspan="3" style="text-align:right;padding:8px 14px;font-size:13px;color:#888;">Subtotal:</td><td style="text-align:right;padding:8px 14px;font-size:13px;font-weight:600;">$${itemSubtotal.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</td></tr>
              <tr><td colspan="3" style="text-align:right;padding:8px 14px;font-size:13px;color:#888;">HST (${itemTaxRate}%):</td><td style="text-align:right;padding:8px 14px;font-size:13px;">$${itemTax.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</td></tr>
              <tr><td colspan="3" style="text-align:right;padding:8px 14px;font-size:15px;font-weight:700;color:#1a1a2e;">Total:</td><td style="text-align:right;padding:8px 14px;font-size:15px;font-weight:700;color:#e94560;">$${itemTotal.toLocaleString("en-CA", { minimumFractionDigits: 2 })} CAD</td></tr>
            </tfoot>
          </table>`;
        }
      } catch (rebuildErr) {
        console.warn("[accept_and_convert] Failed to rebuild line items for email:", rebuildErr);
      }

      // Look up QB payment link from accounting_mirror (only real customer-facing links)
      let qbPaymentUrl = "";
      try {
        const { data: qbMirror } = await svc
          .from("accounting_mirror")
          .select("data, quickbooks_id")
          .eq("entity_type", "Invoice")
          .ilike("data->>DocNumber", invoiceNumber)
          .maybeSingle();
        if (qbMirror) {
          const mirrorData = qbMirror.data as any;
          // Only use InvoiceLink — the customerbalance URL is admin-only, not customer-facing
          if (mirrorData?.InvoiceLink) {
            qbPaymentUrl = mirrorData.InvoiceLink;
          }
        }
      } catch (_e) {
        console.warn("QB mirror lookup error:", _e);
      }

      // Build dual payment buttons
      const paymentButtons: string[] = [];
      if (stripePaymentUrl) {
        paymentButtons.push(`<a href="${stripePaymentUrl}" style="display:inline-block;background:linear-gradient(135deg,#e94560 0%,#c23152 100%);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:8px;font-size:18px;font-weight:700;letter-spacing:1px;box-shadow:0 4px 14px rgba(233,69,96,0.4);width:80%;text-align:center;">💳 Pay via Stripe</a>
          <p style="color:#888;font-size:12px;margin-top:6px;">Secure payment powered by Stripe</p>`);
      }
      if (qbPaymentUrl) {
        paymentButtons.push(`<a href="${qbPaymentUrl}" style="display:inline-block;background:linear-gradient(135deg,#2ca01c 0%,#1a7a12 100%);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:8px;font-size:18px;font-weight:700;letter-spacing:1px;box-shadow:0 4px 14px rgba(44,160,28,0.4);width:80%;text-align:center;">📋 Pay via QuickBooks</a>
          <p style="color:#888;font-size:12px;margin-top:6px;">Pay through QuickBooks Online</p>`);
      }
      const payNowButton = paymentButtons.length > 0
        ? `<div style="text-align:center;margin:32px 0;">${paymentButtons.join('<div style="margin-top:16px;"></div>')}</div>`
        : "";

      const invoiceBodyHtml = `
        <p style="font-size:16px;color:#333;">Dear ${customerName},</p>
        <p style="font-size:15px;color:#555;line-height:1.6;">Thank you for accepting quotation <strong>${quoteNumber}</strong> and confirming your order. Please find your invoice below.</p>
        <div style="background:#f8f9fc;border-radius:8px;padding:20px;margin:24px 0;border-left:4px solid #e94560;">
          <table style="width:100%;">
            <tr><td style="color:#888;font-size:13px;padding:4px 0;">Invoice #</td><td style="text-align:right;font-weight:600;color:#1a1a2e;">${invoiceNumber}</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:4px 0;">Amount Due</td><td style="text-align:right;font-weight:700;color:#e94560;font-size:22px;">$${emailAmountDue.toLocaleString("en-CA", { minimumFractionDigits: 2 })} CAD</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:4px 0;">Issue Date</td><td style="text-align:right;color:#1a1a2e;">${issuedDate}</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:4px 0;">Due Date</td><td style="text-align:right;color:#1a1a2e;font-weight:600;">${dueDate}</td></tr>
          </table>
        </div>
        ${emailLineItemsHtml}
        ${payNowButton}
        <p style="font-size:14px;color:#555;line-height:1.6;margin-top:24px;">
          All amounts are in Canadian Dollars (CAD). Payment is due by <strong>${dueDate}</strong>.
        </p>
      `;

      const brandedInvoiceHtml = buildBrandedEmail({ bodyHtml: invoiceBodyHtml });

      // Send directly via Gmail API (bypasses gmail-send auth requirement)
      const emailOk = await sendEmailDirectViaGmail(svc, resolvedEmail, `Invoice ${invoiceNumber} - REBAR.SHOP`, brandedInvoiceHtml);

      return {
        success: true,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        payment_link: stripePaymentUrl || null,
        email_sent: emailOk,
        message: `Invoice ${invoiceNumber} ${existingInvoice ? "re-sent" : "created"}${emailOk ? ` and sent to ${resolvedEmail}` : " (email failed)"}${stripePaymentUrl ? " with payment link" : ""}`,
      };
    }

    if (action === "send_quote_copy") {
      // ── Send read-only quote copy to customer (no accept button, no status change) ──
      const targetEmail = customer_email;
      if (!targetEmail) {
        throw new Error("Email address is required to send a quote copy");
      }

      const bodyHtml = `
        <p style="font-size:16px;color:#333;">Dear ${customerName},</p>
        <p style="font-size:14px;color:#555;line-height:1.6;">Here is a copy of your quotation for your records.</p>
        <div style="background:#f8f9fc;border-radius:8px;padding:16px;margin:20px 0;border-left:4px solid #e94560;">
          <table style="width:100%;">
            <tr><td style="color:#888;font-size:13px;padding:4px 0;">Quotation #</td><td style="text-align:right;font-weight:600;color:#1a1a2e;">${quoteNumber}</td></tr>
            <tr><td style="color:#888;font-size:13px;padding:4px 0;">Total Amount</td><td style="text-align:right;font-weight:700;color:#e94560;font-size:20px;">$${totalAmount.toLocaleString("en-CA", { minimumFractionDigits: 2 })} CAD</td></tr>
            ${quote.valid_until ? `<tr><td style="color:#888;font-size:13px;padding:4px 0;">Valid Until</td><td style="text-align:right;color:#1a1a2e;">${new Date(quote.valid_until).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</td></tr>` : ""}
          </table>
        </div>
        ${lineItemsTable}
        ${notes ? `<div style="margin-top:20px;padding:16px;background:#fafafa;border-radius:6px;border:1px solid #e5e7eb;"><p style="font-size:12px;color:#888;margin:0 0 8px;font-weight:600;">Notes / Terms:</p><pre style="font-size:12px;color:#555;margin:0;white-space:pre-wrap;font-family:inherit;">${notes}</pre></div>` : ""}
        <p style="font-size:14px;color:#555;margin-top:24px;">If you have any questions, please don't hesitate to reach out.</p>
      `;

      const brandedHtml = buildBrandedEmail({ bodyHtml });

      // Send directly via Gmail API (no user auth context for public callers)
      const emailOk = await sendEmailDirectViaGmail(svc, targetEmail, `Quotation ${quoteNumber} - REBAR.SHOP (Copy)`, brandedHtml);
      if (!emailOk) {
        throw new Error("Failed to send quote copy email. Please try again.");
      }

      return { success: true, message: `Quote copy sent to ${targetEmail}` };
    }

    throw new Error(`Unknown action: ${action}`);
  }, { functionName: "send-quote-email", requireCompany: false, wrapResult: false, authMode: "optional" })
);
