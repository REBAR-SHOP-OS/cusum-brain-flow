import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

/**
 * Auto-Reconciliation Engine
 * 
 * CRITICAL RULE: Only auto-match at 100% confidence.
 * Anything below 100% creates a human_task for Vicky to review.
 * 
 * Matching criteria for 100% confidence:
 * - Exact amount match (to the cent)
 * - Exact date match (same day)
 * - Customer/vendor name match
 * - Single possible match (no ambiguity)
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, serviceClient: supabase } = await requireAuth(req);

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.company_id) return json({ error: "No company found" }, 400);
    const companyId = profile.company_id;

    // Load bank feed balances (these represent known bank transactions)
    // In a real integration, we'd pull actual bank transactions. 
    // For now, we match against accounting_mirror entries.

    // Load all unreconciled transactions from accounting_mirror
    const { data: mirrorTxns } = await supabase
      .from("accounting_mirror")
      .select("id, quickbooks_id, entity_type, balance, data, customer_id")
      .eq("company_id", companyId)
      .in("entity_type", ["Invoice", "Bill", "Payment", "BillPayment", "SalesReceipt", "Deposit"])
      .order("created_at", { ascending: false })
      .limit(500);

    if (!mirrorTxns || mirrorTxns.length === 0) {
      return json({ matched: 0, pending_review: 0, message: "No transactions to reconcile" });
    }

    // Load existing matches to deduplicate
    const { data: existingMatches } = await supabase
      .from("reconciliation_matches")
      .select("matched_mirror_id")
      .eq("company_id", companyId)
      .in("status", ["auto_matched", "approved", "pending"]);

    const alreadyMatched = new Set((existingMatches || []).map(m => m.matched_mirror_id));

    // Load customer names for matching
    const custIds = [...new Set(mirrorTxns.map(t => t.customer_id).filter(Boolean))];
    const customerMap = new Map<string, string>();
    if (custIds.length > 0) {
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", custIds);
      (customers || []).forEach(c => customerMap.set(c.id, c.name));
    }

    // Group transactions by amount+date for matching
    interface TxnEntry {
      id: string;
      quickbooks_id: string;
      entity_type: string;
      amount: number;
      date: string;
      customer_id: string | null;
      customer_name: string;
      description: string;
    }

    const payments: TxnEntry[] = [];
    const receivables: TxnEntry[] = [];

    for (const txn of mirrorTxns) {
      if (alreadyMatched.has(txn.id)) continue;

      const d = txn.data as Record<string, unknown>;
      const amount = (d?.TotalAmt as number) || txn.balance || 0;
      const date = (d?.TxnDate as string) || "";
      const custRef = d?.CustomerRef as { name?: string } | undefined;
      const customerName = (txn.customer_id ? customerMap.get(txn.customer_id) : undefined) || custRef?.name || "";
      const docNumber = (d?.DocNumber as string) || txn.quickbooks_id;

      const entry: TxnEntry = {
        id: txn.id,
        quickbooks_id: txn.quickbooks_id,
        entity_type: txn.entity_type,
        amount: Math.abs(amount),
        date,
        customer_id: txn.customer_id,
        customer_name: customerName,
        description: `${txn.entity_type} #${docNumber}`,
      };

      if (["Payment", "BillPayment"].includes(txn.entity_type)) {
        payments.push(entry);
      } else {
        receivables.push(entry);
      }
    }

    // Match payments to receivables
    const matchResults: {
      mirror_id: string;
      entity_type: string;
      entity_id: string;
      amount: number;
      date: string;
      confidence: number;
      reason: string;
      matched_to?: TxnEntry;
    }[] = [];

    for (const payment of payments) {
      // Find receivables with exact same amount
      const amountMatches = receivables.filter(r =>
        Math.abs(r.amount - payment.amount) < 0.01
      );

      if (amountMatches.length === 0) continue;

      // Filter by same customer
      const customerMatches = amountMatches.filter(r =>
        r.customer_name && payment.customer_name &&
        r.customer_name.toLowerCase() === payment.customer_name.toLowerCase()
      );

      // Filter by same date
      const dateAndCustomerMatches = customerMatches.filter(r => r.date === payment.date);

      let confidence = 0;
      let matchedTo: TxnEntry | undefined;
      let reason = "";

      if (dateAndCustomerMatches.length === 1) {
        // EXACT match: same amount, same customer, same date, single result
        confidence = 100;
        matchedTo = dateAndCustomerMatches[0];
        reason = `Exact match: amount $${payment.amount}, customer "${payment.customer_name}", date ${payment.date}`;
      } else if (customerMatches.length === 1) {
        // Same amount + same customer, different date
        confidence = 85;
        matchedTo = customerMatches[0];
        reason = `Amount + customer match: $${payment.amount}, "${payment.customer_name}". Dates differ: payment ${payment.date} vs receivable ${matchedTo.date}`;
      } else if (amountMatches.length === 1) {
        // Same amount, different customer or no customer
        confidence = 60;
        matchedTo = amountMatches[0];
        reason = `Amount-only match: $${payment.amount}. Customer may differ.`;
      } else if (amountMatches.length > 1) {
        // Multiple amount matches — ambiguous
        confidence = 30;
        matchedTo = amountMatches[0]; // Pick first as suggestion
        reason = `Ambiguous: ${amountMatches.length} transactions with same amount $${payment.amount}. Manual review required.`;
      }

      if (matchedTo) {
        matchResults.push({
          mirror_id: payment.id,
          entity_type: payment.entity_type,
          entity_id: payment.quickbooks_id,
          amount: payment.amount,
          date: payment.date,
          confidence,
          reason,
          matched_to: matchedTo,
        });
      }
    }

    let autoMatchCount = 0;
    let pendingReviewCount = 0;

    for (const match of matchResults) {
      const isAutoMatch = match.confidence === 100;

      // Insert reconciliation match record
      await supabase.from("reconciliation_matches").insert({
        company_id: companyId,
        bank_account_id: "qb-mirror",
        bank_txn_date: match.date || new Date().toISOString().split("T")[0],
        bank_txn_amount: match.amount,
        bank_txn_description: `${match.entity_type} #${match.entity_id}`,
        matched_entity_type: match.matched_to?.entity_type,
        matched_entity_id: match.matched_to?.quickbooks_id,
        matched_mirror_id: match.matched_to?.id,
        confidence: match.confidence,
        match_reason: match.reason,
        status: isAutoMatch ? "auto_matched" : "pending",
      });

      if (isAutoMatch) {
        autoMatchCount++;
      } else {
        pendingReviewCount++;

        // Create human_task for Vicky to review
        // Find Vicky's profile
        const { data: vickyProfile } = await supabase
          .from("profiles")
          .select("id")
          .ilike("full_name", "%vicky%")
          .eq("company_id", companyId)
          .limit(1)
          .single();

        // Also try by email if not found by name
        let assignedTo = vickyProfile?.id;
        if (!assignedTo) {
          const { data: vickyByEmail } = await supabase
            .from("profiles")
            .select("id")
            .ilike("email", "%vicky%")
            .eq("company_id", companyId)
            .limit(1)
            .single();
          assignedTo = vickyByEmail?.id;
        }

        // Fallback: assign to any admin
        if (!assignedTo) {
          const { data: adminProfile } = await supabase.rpc("get_user_company_id", { _user_id: userId });
          // Just leave unassigned if no Vicky found
        }

        await supabase.from("human_tasks").insert({
          company_id: companyId,
          title: `🔄 Reconciliation Review: ${match.entity_type} $${match.amount.toLocaleString()}`,
          description: `Confidence: ${match.confidence}%\n${match.reason}\n\nPayment: ${match.entity_type} #${match.entity_id}\nSuggested match: ${match.matched_to?.description}`,
          severity: match.confidence < 50 ? "warning" : "info",
          category: "reconciliation_review",
          source: "auto-reconcile",
          ...(assignedTo ? { assigned_to: assignedTo } : {}),
        });
      }
    }

    return json({
      total_processed: mirrorTxns.length,
      matched: autoMatchCount,
      pending_review: pendingReviewCount,
      message: autoMatchCount > 0
        ? `Auto-matched ${autoMatchCount} transaction(s) at 100% confidence. ${pendingReviewCount} sent to Vicky for review.`
        : pendingReviewCount > 0
        ? `${pendingReviewCount} potential match(es) sent to Vicky for review (below 100% confidence).`
        : "No new matches found.",
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("auto-reconcile error:", e);
    return json({ error: String(e) }, 500);
  }
});
