import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { buildBrandedEmail, fetchActorSignature } from "../_shared/brandedEmail.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const sendSchema = z.object({
  quote_id: z.string().uuid(),
  customer_email: z.string().email(),
  action: z.enum(["send_quote", "convert_to_invoice"]),
});

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

    const { quote_id, customer_email, action } = parsed.data;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

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
    const subtotal = totalAmount / (1 + taxRate / 100);
    const taxAmount = totalAmount - subtotal;

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
            ${quote.valid_until ? `<tr><td style="color:#888;font-size:13px;padding:4px 0;">Valid Until</td><td style="text-align:right;color:#1a1a2e;">${quote.valid_until}</td></tr>` : ""}
          </table>
        </div>
        ${lineItemsTable}
        ${notes ? `<div style="margin-top:20px;padding:16px;background:#fafafa;border-radius:6px;border:1px solid #e5e7eb;"><p style="font-size:12px;color:#888;margin:0 0 8px;font-weight:600;">Notes / Terms:</p><pre style="font-size:12px;color:#555;margin:0;white-space:pre-wrap;font-family:inherit;">${notes}</pre></div>` : ""}
        <p style="font-size:14px;color:#555;margin-top:24px;">If you have any questions, please don't hesitate to reach out.</p>
      `;

      const brandedHtml = buildBrandedEmail({
        bodyHtml,
        signatureHtml: sigHtml || undefined,
        actorName: meta.actor_name,
      });

      // Send via gmail-send
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: Deno.env.get("SUPABASE_ANON_KEY") || "" },
        body: JSON.stringify({
          to: customer_email,
          subject: `Quotation ${quoteNumber} — REBAR.SHOP`,
          body: brandedHtml,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        throw new Error(`Email send failed: ${errText}`);
      }

      // Update quote status
      await svc.from("quotes").update({ status: "sent" } as any).eq("id", quote_id);

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
        signatureHtml: sigHtml || undefined,
        actorName: meta.actor_name,
      });

      // 6. Send invoice email
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/gmail-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          to: customer_email,
          subject: `Invoice ${invoiceNumber} — REBAR.SHOP`,
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

    throw new Error(`Unknown action: ${action}`);
  }, { functionName: "send-quote-email", requireCompany: false, wrapResult: false })
);
