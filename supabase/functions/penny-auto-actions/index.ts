import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, serviceClient: supabase } = await requireAuth(req);

    // Get user's company_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.company_id) return json({ error: "No company found" }, 400);
    const companyId = profile.company_id;

    // Load configurable thresholds from comms_config (penny_config JSON field)
    let thresholds = { email_reminder: 7, call_collection: 14, send_invoice: 30, escalate: 60 };
    try {
      const { data: config } = await supabase
        .from("comms_config")
        .select("response_thresholds_hours")
        .eq("company_id", companyId)
        .single();
      if (config?.response_thresholds_hours) {
        const custom = config.response_thresholds_hours as Record<string, unknown>;
        if (custom.penny_thresholds) {
          const pt = custom.penny_thresholds as Record<string, number>;
          thresholds = { ...thresholds, ...pt };
        }
      }
    } catch (_e) { /* use defaults */ }

    // Load overdue invoices from accounting_mirror
    const { data: overdueInvoices } = await supabase
      .from("accounting_mirror")
      .select("id, quickbooks_id, data, balance, customer_id")
      .eq("entity_type", "Invoice")
      .eq("company_id", companyId)
      .gt("balance", 0);

    // Auto-clean: reject pending items whose invoices have been paid
    const { data: staleItems } = await supabase
      .from("penny_collection_queue")
      .select("id, invoice_id")
      .eq("company_id", companyId)
      .eq("status", "pending_approval");

    let autoResolved = 0;
    for (const item of staleItems || []) {
      if (!item.invoice_id) continue;
      const { data: mirror } = await supabase
        .from("accounting_mirror")
        .select("balance")
        .eq("quickbooks_id", item.invoice_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (mirror && (mirror.balance ?? 0) <= 0) {
        await supabase
          .from("penny_collection_queue")
          .update({ status: "rejected", execution_result: { reject_reason: "Invoice paid - auto-resolved" } })
          .eq("id", item.id);
        autoResolved++;
      }
    }

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return json({ queued: 0, auto_resolved: autoResolved, message: "No overdue invoices found" });
    }

    // Batch-load customer names from customers table
    const custIds = [...new Set(overdueInvoices.map(i => i.customer_id).filter(Boolean))];
    const customerNameMap = new Map<string, string>();
    if (custIds.length > 0) {
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", custIds);
      (customers || []).forEach(c => { if (c.name) customerNameMap.set(c.id, c.name); });
    }

    // Load existing pending actions to deduplicate (by invoice_id AND customer_id)
    const { data: existingActions } = await supabase
      .from("penny_collection_queue")
      .select("invoice_id, customer_name")
      .eq("company_id", companyId)
      .eq("status", "pending_approval");

    const existingInvoiceIds = new Set((existingActions || []).map(a => a.invoice_id));
    
    // Customer-level dedup: track which customers already have a pending consolidated action
    const existingCustomerPending = new Set((existingActions || []).map(a => a.customer_name));

    // Load customer contacts for email/phone
    const customerIds = [...new Set(overdueInvoices.map(i => i.customer_id).filter(Boolean))];
    const { data: contacts } = customerIds.length > 0
      ? await supabase.from("contacts").select("customer_id, email, phone").in("customer_id", customerIds)
      : { data: [] };

    const contactMap = new Map<string, { email?: string; phone?: string }>();
    (contacts || []).forEach(c => {
      if (c.customer_id && !contactMap.has(c.customer_id)) {
        contactMap.set(c.customer_id, { email: c.email || undefined, phone: c.phone || undefined });
      }
    });

    const now = new Date();

    // Group overdue invoices by customer_id for consolidated actions
    const customerInvoiceGroups = new Map<string, {
      customerName: string;
      customerId: string | null;
      invoices: { docNumber: string; quickbooksId: string; balance: number; daysOverdue: number; dueDate: string }[];
      totalAmount: number;
      maxDaysOverdue: number;
    }>();

    for (const inv of overdueInvoices) {
      const invData = inv.data as Record<string, unknown>;
      const dueDate = invData?.DueDate ? new Date(invData.DueDate as string) : null;
      if (!dueDate || dueDate >= now) continue;

      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
      if (daysOverdue < thresholds.email_reminder) continue;

      const invoiceRef = inv.quickbooks_id;
      if (existingInvoiceIds.has(invoiceRef)) continue;

      const customerRef = invData?.CustomerRef as { name?: string; value?: string } | undefined;
      const customerName = (inv.customer_id ? customerNameMap.get(inv.customer_id) : undefined) ?? customerRef?.name ?? "Unknown Customer";
      const groupKey = inv.customer_id || customerName;

      // Skip if this customer already has a pending consolidated action
      if (existingCustomerPending.has(customerName)) continue;

      if (!customerInvoiceGroups.has(groupKey)) {
        customerInvoiceGroups.set(groupKey, {
          customerName,
          customerId: inv.customer_id,
          invoices: [],
          totalAmount: 0,
          maxDaysOverdue: 0,
        });
      }
      const group = customerInvoiceGroups.get(groupKey)!;
      group.invoices.push({
        docNumber: (invData?.DocNumber as string) || invoiceRef,
        quickbooksId: invoiceRef,
        balance: inv.balance || 0,
        daysOverdue,
        dueDate: (invData?.DueDate as string) || "",
      });
      group.totalAmount += inv.balance || 0;
      group.maxDaysOverdue = Math.max(group.maxDaysOverdue, daysOverdue);
    }

    // Build ONE consolidated action per customer
    const actionsToQueue: Record<string, unknown>[] = [];

    for (const [, group] of customerInvoiceGroups) {
      const { customerName, customerId, invoices, totalAmount, maxDaysOverdue } = group;
      const contact = customerId ? contactMap.get(customerId) : undefined;
      const invoiceList = invoices.map(i => `#${i.docNumber} ($${i.balance.toLocaleString()}, ${i.daysOverdue}d)`).join(", ");

      let actionType: string;
      let priority: string;
      let reasoning: string;

      if (maxDaysOverdue >= thresholds.escalate) {
        actionType = "escalate";
        priority = "critical";
        reasoning = `${customerName} has ${invoices.length} overdue invoice(s) totaling $${totalAmount.toLocaleString()} (oldest: ${maxDaysOverdue} days). Requires escalation. Invoices: ${invoiceList}`;
      } else if (maxDaysOverdue >= thresholds.send_invoice) {
        actionType = "send_invoice";
        priority = "high";
        reasoning = `${customerName} has ${invoices.length} overdue invoice(s) totaling $${totalAmount.toLocaleString()} (oldest: ${maxDaysOverdue} days). Re-sending with firm payment request. Invoices: ${invoiceList}`;
      } else if (maxDaysOverdue >= thresholds.call_collection) {
        actionType = "call_collection";
        priority = "medium";
        reasoning = `${customerName} has ${invoices.length} overdue invoice(s) totaling $${totalAmount.toLocaleString()} (oldest: ${maxDaysOverdue} days). A phone call is recommended. Invoices: ${invoiceList}`;
      } else {
        actionType = "email_reminder";
        priority = "low";
        reasoning = `${customerName} has ${invoices.length} overdue invoice(s) totaling $${totalAmount.toLocaleString()} (oldest: ${maxDaysOverdue} days). A friendly email reminder should suffice. Invoices: ${invoiceList}`;
      }

      // Generate AI-powered draft content via Lovable AI gateway
      let emailBody: string | undefined;
      let emailSubject: string | undefined;
      let callScript: string | undefined;

      if (actionType === "email_reminder" || actionType === "send_invoice") {
        try {
          const aiDraft = await generateAIDraft(customerName, invoices, totalAmount, maxDaysOverdue, actionType);
          emailBody = aiDraft.body;
          emailSubject = aiDraft.subject;
        } catch (e) {
          console.error("AI draft generation failed, using fallback:", e);
          emailBody = generateEmailDraftFallback(customerName, invoices, totalAmount, maxDaysOverdue, actionType);
          emailSubject = `Payment ${actionType === "send_invoice" ? "Notice" : "Reminder"}: ${invoices.length === 1 ? `Invoice #${invoices[0].docNumber}` : `${invoices.length} Invoices`}`;
        }
      }

      if (actionType === "call_collection") {
        try {
          const aiScript = await generateAICallScript(customerName, invoices, totalAmount, maxDaysOverdue);
          callScript = aiScript;
        } catch (e) {
          console.error("AI call script generation failed, using fallback:", e);
          callScript = generateCallScriptFallback(customerName, invoices, totalAmount, maxDaysOverdue);
        }
      }

      actionsToQueue.push({
        company_id: companyId,
        invoice_id: invoices[0].quickbooksId, // primary invoice
        customer_name: customerName,
        customer_email: contact?.email || null,
        customer_phone: contact?.phone || null,
        amount: totalAmount,
        days_overdue: maxDaysOverdue,
        action_type: actionType,
        action_payload: {
          consolidated: invoices.length > 1,
          invoice_count: invoices.length,
          invoices: invoices.map(i => ({ doc_number: i.docNumber, balance: i.balance, days_overdue: i.daysOverdue, due_date: i.dueDate })),
          ...(emailBody ? { email_body: emailBody, email_subject: emailSubject } : {}),
          ...(callScript ? { call_script: callScript } : {}),
        },
        status: "pending_approval",
        priority,
        ai_reasoning: reasoning,
        followup_count: 0,
      });
    }

    // Batch insert
    if (actionsToQueue.length > 0) {
      const { error: insertError } = await supabase
        .from("penny_collection_queue")
        .insert(actionsToQueue);
      if (insertError) {
        console.error("Failed to insert queue items:", insertError);
        return json({ error: "Failed to queue actions" }, 500);
      }
    }

    return json({ queued: actionsToQueue.length, consolidated_customers: customerInvoiceGroups.size });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("penny-auto-actions error:", e);
    return json({ error: String(e) }, 500);
  }
});

// AI-powered email draft generation — GPT for customer-facing writing
async function generateAIDraft(
  customer: string,
  invoices: { docNumber: string; balance: number; daysOverdue: number }[],
  totalAmount: number,
  maxDays: number,
  type: string,
): Promise<{ subject: string; body: string }> {
  const { callAI } = await import("../_shared/aiRouter.ts");
  const invoiceDetails = invoices.map(i => `Invoice #${i.docNumber}: $${i.balance.toLocaleString()}, ${i.daysOverdue} days overdue`).join("\n");
  const tone = type === "send_invoice" ? "firm but professional" : "friendly and polite";

  const result = await callAI({
    provider: "gpt",
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `You are an AR collections assistant for a Canadian rebar manufacturing company. Write ${tone} collection emails. Be concise. Output ONLY valid JSON with "subject" and "body" keys. The body should be plain text (no HTML).` },
      { role: "user", content: `Write a collection email to ${customer} for:\n${invoiceDetails}\n\nTotal outstanding: $${totalAmount.toLocaleString()}\nOldest overdue: ${maxDays} days\n\nSign off as the Accounts Receivable team at Rebar.shop.` },
    ],
    temperature: 0.3,
    maxTokens: 800,
  });

  const content = result.content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    return { subject: parsed.subject, body: parsed.body };
  }
  throw new Error("Could not parse AI response");
}

// AI-powered call script generation
async function generateAICallScript(
  customer: string,
  invoices: { docNumber: string; balance: number; daysOverdue: number }[],
  totalAmount: number,
  maxDays: number,
): Promise<string> {
  const { callAI } = await import("../_shared/aiRouter.ts");
  const invoiceDetails = invoices.map(i => `Invoice #${i.docNumber}: $${i.balance.toLocaleString()}, ${i.daysOverdue} days overdue`).join("\n");

  const result = await callAI({
    provider: "gpt",
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an AR collections assistant for a Canadian rebar company. Write a brief, professional phone call script for collecting overdue payments. Include opening, key talking points, and voicemail script. Plain text only." },
      { role: "user", content: `Write a call script for collecting from ${customer}:\n${invoiceDetails}\n\nTotal: $${totalAmount.toLocaleString()}\nOldest overdue: ${maxDays} days` },
    ],
    temperature: 0.3,
    maxTokens: 600,
  });

  return result.content || generateCallScriptFallback(customer, invoices, totalAmount, maxDays);
}

// Fallback templates (used when AI generation fails)
function generateEmailDraftFallback(
  customer: string,
  invoices: { docNumber: string; balance: number; daysOverdue: number }[],
  totalAmount: number,
  maxDays: number,
  type: string,
): string {
  const invoiceList = invoices.map(i => `  • Invoice #${i.docNumber} — $${i.balance.toLocaleString()} (${i.daysOverdue} days overdue)`).join("\n");

  if (type === "send_invoice") {
    return `Dear ${customer},

This is a follow-up regarding ${invoices.length === 1 ? `Invoice #${invoices[0].docNumber}` : `${invoices.length} outstanding invoices`} totaling $${totalAmount.toLocaleString()}, now up to ${maxDays} days past due.

${invoiceList}

We kindly request immediate payment to avoid any disruption to your account. If payment has already been sent, please disregard this notice.

Please contact us if you have any questions or need to discuss payment arrangements.

Best regards,
Accounts Receivable — Rebar.shop`;
  }

  return `Hi ${customer},

This is a friendly reminder that you have ${invoices.length === 1 ? `an outstanding invoice` : `${invoices.length} outstanding invoices`} totaling $${totalAmount.toLocaleString()}:

${invoiceList}

If payment has already been sent, please disregard this message. Otherwise, we'd appreciate payment at your earliest convenience.

Best regards,
Accounts Receivable — Rebar.shop`;
}

function generateCallScriptFallback(
  customer: string,
  invoices: { docNumber: string; balance: number; daysOverdue: number }[],
  totalAmount: number,
  maxDays: number,
): string {
  const invoiceList = invoices.map(i => `Invoice #${i.docNumber}: $${i.balance.toLocaleString()} (${i.daysOverdue} days)`).join(", ");
  return `COLLECTION CALL SCRIPT — ${customer}

Opening: "Hi, this is [Your Name] from Rebar.shop. I'm calling regarding ${invoices.length === 1 ? `Invoice #${invoices[0].docNumber}` : `${invoices.length} outstanding invoices`} totaling $${totalAmount.toLocaleString()}, up to ${maxDays} days past due."

Invoices: ${invoiceList}

If they answer:
• Confirm they received the invoice(s)
• Confirm the total amount: $${totalAmount.toLocaleString()}
• Ask when payment can be expected
• Offer payment plan if > 30 days overdue
• Note the commitment date

If voicemail:
• Leave a brief message requesting a callback
• Reference the total amount and number of invoices

Follow-up: Log outcome and schedule next action.`;
}
