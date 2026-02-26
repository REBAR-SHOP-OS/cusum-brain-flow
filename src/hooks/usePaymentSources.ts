import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import type { QBPayment } from "@/hooks/useQuickBooksData";

export type PaymentSource = "quickbooks" | "stripe" | "bmo" | "odoo";

export interface UnifiedPayment {
  id: string;
  date: string;
  customerName: string;
  amount: number;
  source: PaymentSource;
  sourceRef?: string; // e.g. stripe URL or QB invoice id
  raw?: any;
}

export interface SourceSummary {
  source: PaymentSource;
  label: string;
  total: number;
  count: number;
  status: "connected" | "synced" | "archived" | "disconnected" | "error";
  lastSync?: string | null;
}

export interface ReconciliationIndicator {
  pair: string;
  balanced: boolean;
  variance: number;
  detail: string;
}

export function usePaymentSources(qbPayments: QBPayment[]) {
  const { companyId } = useCompanyId();

  // Stripe payment links
  const { data: stripeLinks } = useQuery({
    queryKey: ["stripe_payment_links", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("stripe_payment_links")
        .select("*")
        .eq("company_id", companyId);
      return (data ?? []) as any[];
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });

  // BMO / bank activity
  const { data: bankActivity } = useQuery({
    queryKey: ["qb_bank_activity", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("qb_bank_activity")
        .select("*")
        .eq("company_id", companyId);
      return (data ?? []) as any[];
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });

  // Stripe live connection status
  const { data: stripeStatus } = useQuery({
    queryKey: ["stripe_live_status"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "check-status" },
      });
      return data;
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Odoo / WooCommerce archived orders
  const { data: wcOrders } = useQuery({
    queryKey: ["wc_qb_order_map_count", companyId],
    queryFn: async () => {
      if (!companyId) return { count: 0, total: 0 };
      const { data, count } = await supabase
        .from("wc_qb_order_map")
        .select("total_amount", { count: "exact" })
        .eq("company_id", companyId);
      const total = (data ?? []).reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0);
      return { count: count ?? 0, total };
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 10,
  });

  // ── Unified payment list ──
  const unifiedPayments = useMemo<UnifiedPayment[]>(() => {
    const qb: UnifiedPayment[] = qbPayments.map((p) => ({
      id: `qb-${p.Id}`,
      date: p.TxnDate,
      customerName: p.CustomerRef?.name || "Unknown",
      amount: p.TotalAmt,
      source: "quickbooks" as const,
      raw: p,
    }));

    const stripe: UnifiedPayment[] = (stripeLinks ?? []).map((l: any) => ({
      id: `stripe-${l.id}`,
      date: l.created_at?.slice(0, 10) || "",
      customerName: l.customer_name || "Stripe Customer",
      amount: Number(l.amount) || 0,
      source: "stripe" as const,
      sourceRef: l.stripe_url,
      raw: l,
    }));

    return [...qb, ...stripe].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [qbPayments, stripeLinks]);

  // ── Source summaries ──
  const sourceSummaries = useMemo<SourceSummary[]>(() => {
    const qbTotal = qbPayments.reduce((s, p) => s + p.TotalAmt, 0);
    const stripeTotal = (stripeLinks ?? []).reduce((s: number, l: any) => s + (Number(l.amount) || 0), 0);
    const bmoLedger = (bankActivity ?? []).reduce((s: number, a: any) => s + (Number(a.ledger_balance) || 0), 0);
    const bmoLastSync = (bankActivity ?? []).reduce(
      (latest: string | null, a: any) => {
        if (!a.last_qb_sync_at) return latest;
        if (!latest || a.last_qb_sync_at > latest) return a.last_qb_sync_at;
        return latest;
      },
      null as string | null
    );

    return [
      {
        source: "quickbooks" as const,
        label: "QuickBooks",
        total: qbTotal,
        count: qbPayments.length,
        status: "connected" as const,
      },
      {
        source: "stripe" as const,
        label: "Stripe",
        total: stripeTotal,
        count: (stripeLinks ?? []).length,
        status: stripeStatus?.status === "connected"
          ? "connected" as const
          : stripeStatus?.errorType
            ? "error" as const
            : "disconnected" as const,
      },
      {
        source: "bmo" as const,
        label: "BMO Bank",
        total: bmoLedger,
        count: (bankActivity ?? []).length,
        status: (bankActivity ?? []).length > 0 ? "synced" as const : "disconnected" as const,
        lastSync: bmoLastSync,
      },
      {
        source: "odoo" as const,
        label: "Odoo",
        total: wcOrders?.total ?? 0,
        count: wcOrders?.count ?? 0,
        status: "archived" as const,
      },
    ];
  }, [qbPayments, stripeLinks, bankActivity, wcOrders, stripeStatus]);

  // ── Reconciliation ──
  const reconciliation = useMemo<ReconciliationIndicator[]>(() => {
    const indicators: ReconciliationIndicator[] = [];
    const qbSummary = sourceSummaries.find((s) => s.source === "quickbooks");
    const stripeSummary = sourceSummaries.find((s) => s.source === "stripe");
    const bmoSummary = sourceSummaries.find((s) => s.source === "bmo");

    // QB vs Stripe — matched invoice links
    if (stripeSummary && stripeSummary.count > 0) {
      const matchedLinks = (stripeLinks ?? []).filter((l: any) => !!l.qb_invoice_id);
      const matchedTotal = matchedLinks.reduce((s: number, l: any) => s + (Number(l.amount) || 0), 0);
      indicators.push({
        pair: "QB ↔ Stripe",
        balanced: matchedLinks.length > 0,
        variance: matchedTotal,
        detail: `${matchedLinks.length} invoice(s) with Stripe links`,
      });
    }

    // QB vs BMO — total collected vs ledger
    if (qbSummary && bmoSummary && bmoSummary.count > 0) {
      const variance = Math.abs(qbSummary.total - bmoSummary.total);
      indicators.push({
        pair: "QB ↔ BMO",
        balanced: variance < 100,
        variance,
        detail: variance < 100 ? "Balanced" : `Variance: $${variance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      });
    }

    return indicators;
  }, [sourceSummaries, stripeLinks]);

  return { unifiedPayments, sourceSummaries, reconciliation };
}
