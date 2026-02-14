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

    // Load overdue invoices from accounting_mirror
    const { data: overdueInvoices } = await supabase
      .from("accounting_mirror")
      .select("id, quickbooks_id, data, balance, customer_id")
      .eq("entity_type", "Invoice")
      .eq("company_id", companyId)
      .gt("balance", 0);

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return json({ queued: 0, message: "No overdue invoices found" });
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

    // Load existing pending actions to deduplicate
    const { data: existingActions } = await supabase
      .from("penny_collection_queue")
      .select("invoice_id")
      .eq("company_id", companyId)
      .eq("status", "pending_approval");

    const existingInvoiceIds = new Set((existingActions || []).map(a => a.invoice_id));

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
    const actionsToQueue: Record<string, unknown>[] = [];

    for (const inv of overdueInvoices) {
      const invData = inv.data as Record<string, unknown>;
      const dueDate = invData?.DueDate ? new Date(invData.DueDate as string) : null;
      if (!dueDate || dueDate >= now) continue;

      const invoiceRef = inv.quickbooks_id;
      if (existingInvoiceIds.has(invoiceRef)) continue;

      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
      const customerRef = invData?.CustomerRef as { name?: string; value?: string } | undefined;
      const customerName = (inv.customer_id ? customerNameMap.get(inv.customer_id) : undefined) ?? customerRef?.name ?? "Unknown Customer";
      const contact = inv.customer_id ? contactMap.get(inv.customer_id) : undefined;

      let actionType: string;
      let priority: string;
      let reasoning: string;

      if (daysOverdue >= 60) {
        actionType = "escalate";
        priority = "critical";
        reasoning = `Invoice #${invData?.DocNumber || invoiceRef} is ${daysOverdue} days overdue ($${inv.balance}). This requires CEO-level escalation.`;
      } else if (daysOverdue >= 30) {
        actionType = "send_invoice";
        priority = "high";
        reasoning = `Invoice #${invData?.DocNumber || invoiceRef} is ${daysOverdue} days overdue. Re-sending with a firm payment request.`;
      } else if (daysOverdue >= 14) {
        actionType = "call_collection";
        priority = "medium";
        reasoning = `Invoice #${invData?.DocNumber || invoiceRef} is ${daysOverdue} days overdue. A direct phone call is recommended.`;
      } else if (daysOverdue >= 7) {
        actionType = "email_reminder";
        priority = "low";
        reasoning = `Invoice #${invData?.DocNumber || invoiceRef} is ${daysOverdue} days overdue. A friendly email reminder should suffice.`;
      } else {
        continue;
      }

      // Generate draft content based on action type
      const emailBody = actionType === "email_reminder" || actionType === "send_invoice"
        ? generateEmailDraft(customerName, invData?.DocNumber as string, inv.balance || 0, daysOverdue, actionType)
        : undefined;

      const callScript = actionType === "call_collection"
        ? generateCallScript(customerName, invData?.DocNumber as string, inv.balance || 0, daysOverdue)
        : undefined;

      actionsToQueue.push({
        company_id: companyId,
        invoice_id: invoiceRef,
        customer_name: customerName,
        customer_email: contact?.email || null,
        customer_phone: contact?.phone || null,
        amount: inv.balance || 0,
        days_overdue: daysOverdue,
        action_type: actionType,
        action_payload: {
          invoice_doc_number: invData?.DocNumber,
          due_date: invData?.DueDate,
          ...(emailBody ? { email_body: emailBody, email_subject: `Payment Reminder: Invoice #${invData?.DocNumber}` } : {}),
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

    return json({ queued: actionsToQueue.length });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("penny-auto-actions error:", e);
    return json({ error: String(e) }, 500);
  }
});

function generateEmailDraft(customer: string, docNumber: string, amount: number, days: number, type: string): string {
  if (type === "send_invoice") {
    return `Dear ${customer},

This is a follow-up regarding Invoice #${docNumber} for $${amount.toLocaleString()}, which is now ${days} days past due.

We kindly request immediate payment to avoid any disruption to your account. If payment has already been sent, please disregard this notice.

Please contact us if you have any questions or need to discuss payment arrangements.

Thank you for your prompt attention to this matter.

Best regards`;
  }

  return `Hi ${customer},

This is a friendly reminder that Invoice #${docNumber} for $${amount.toLocaleString()} was due ${days} days ago.

If payment has already been sent, please disregard this message. Otherwise, we'd appreciate payment at your earliest convenience.

Please don't hesitate to reach out if you have any questions.

Best regards`;
}

function generateCallScript(customer: string, docNumber: string, amount: number, days: number): string {
  return `COLLECTION CALL SCRIPT — ${customer}

Opening: "Hi, this is [Your Name] from [Company]. I'm calling regarding Invoice #${docNumber} for $${amount.toLocaleString()}, which is ${days} days past due."

If they answer:
• Ask if they received the invoice
• Confirm the amount and due date
• Ask when payment can be expected
• Offer payment plan if > 30 days overdue
• Note the commitment date

If voicemail:
• Leave a brief message requesting a callback
• Reference the invoice number and amount

Follow-up: Log outcome and schedule next action.`;
}
