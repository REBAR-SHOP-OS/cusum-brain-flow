export interface AIExplainerResponse {
  what_changed: string;
  top_drivers: string[];
  recommended_actions: { title: string; owner_suggestion: string; impact: "low" | "med" | "high" }[];
}
