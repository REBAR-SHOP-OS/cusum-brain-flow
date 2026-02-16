export type Venture = {
  id: string;
  created_by: string;
  company_id: string | null;
  name: string;
  vertical: string | null;
  phase: string;
  problem_statement: string | null;
  target_customer: string | null;
  value_multiplier: string | null;
  competitive_notes: string | null;
  mvp_scope: string | null;
  distribution_plan: string | null;
  metrics: Record<string, unknown>;
  revenue_model: string | null;
  ai_analysis: Record<string, unknown> | null;
  linked_lead_id: string | null;
  linked_order_ids: string[];
  odoo_context: Record<string, unknown> | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const PHASES = [
  { key: "target_selection", label: "Target Selection", emoji: "🎯" },
  { key: "weapon_build", label: "Weapon Build", emoji: "⚔️" },
  { key: "market_feedback", label: "Market Feedback", emoji: "📊" },
  { key: "scale_engine", label: "Scale Engine", emoji: "🚀" },
  { key: "empire_expansion", label: "Empire Expansion", emoji: "🏛️" },
];
