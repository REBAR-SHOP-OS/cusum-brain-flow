import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

export interface LeadRecommendation {
  action_type: string;
  headline: string;
  reasoning: string;
  urgency: "now" | "today" | "this_week" | "next_week";
  confidence: number;
}

/**
 * Fetches AI next-best-action recommendation for a single lead.
 * Only triggers when the drawer is open (enabled=true) and lead has scoring data.
 */
export function useLeadRecommendation(lead: Lead | null, enabled: boolean) {
  return useQuery({
    queryKey: ["lead-recommendation", lead?.id],
    queryFn: async (): Promise<LeadRecommendation | null> => {
      if (!lead) return null;

      const meta = (lead.metadata ?? {}) as Record<string, unknown>;
      const validationWarnings = (meta.validation_warnings as number) || 0;

      // Fetch client performance if customer linked
      let clientPerformance = null;
      if (lead.customer_id) {
        const { data } = await supabase
          .from("client_performance_memory")
          .select("win_rate_pct, client_lifetime_score, reorder_rate_pct, avg_margin_pct")
          .eq("customer_id", lead.customer_id)
          .single();
        clientPerformance = data;
      }

      const { data, error } = await supabase.functions.invoke("pipeline-ai", {
        body: {
          action: "next_best_action",
          lead: {
            title: lead.title,
            stage: lead.stage,
            priority: lead.priority,
            probability: lead.probability,
            expected_revenue: lead.expected_value,
            source: lead.source,
            notes: lead.notes,
            created_at: lead.created_at,
            customer_name: meta.odoo_partner || meta.odoo_contact || null,
            win_prob_score: lead.win_prob_score,
            priority_score: lead.priority_score,
            score_confidence: lead.score_confidence,
          },
          clientPerformance,
          validationWarnings,
        },
      });

      if (error) {
        console.error("Recommendation fetch error:", error);
        return null;
      }

      return data as LeadRecommendation;
    },
    enabled: enabled && !!lead?.id,
    staleTime: 5 * 60 * 1000, // Cache 5 min
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}

const ACTION_ICONS: Record<string, string> = {
  call: "📞",
  email: "✉️",
  meeting: "📅",
  stage_move: "➡️",
  follow_up: "🔄",
  escalate: "🚨",
  close_deal: "🎯",
  data_fix: "🔧",
};

const URGENCY_LABELS: Record<string, { label: string; class: string }> = {
  now: { label: "Now", class: "text-destructive" },
  today: { label: "Today", class: "text-orange-600 dark:text-orange-400" },
  this_week: { label: "This week", class: "text-amber-600 dark:text-amber-400" },
  next_week: { label: "Next week", class: "text-muted-foreground" },
};

export function getActionIcon(actionType: string): string {
  return ACTION_ICONS[actionType] || "💡";
}

export function getUrgencyConfig(urgency: string) {
  return URGENCY_LABELS[urgency] || URGENCY_LABELS.this_week;
}
