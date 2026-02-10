export interface HealthDriver {
  label: string;
  score: number;
  weight: number;
  delta: number; // vs yesterday
}

export interface KpiCardData {
  id: string;
  label: string;
  value: string;
  sub: string;
  alertActive?: boolean;
  icon: string;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
}

export interface ExceptionItem {
  id: string;
  category: "cash" | "ops" | "sales" | "delivery";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  owner: string;
  age: string;
  customer?: string;
  value?: number;
  actions: ExceptionAction[];
}

export interface ExceptionAction {
  label: string;
  type: "primary" | "secondary";
}

export interface AIExplainerResponse {
  what_changed: string;
  top_drivers: string[];
  recommended_actions: { title: string; owner_suggestion: string; impact: "low" | "med" | "high" }[];
}

export interface ARAgingBucket {
  bucket: string;
  amount: number;
  count: number;
}

export interface AtRiskJob {
  id: string;
  name: string;
  customer: string;
  dueDate: string;
  daysLeft: number;
  riskReason: string;
  probability: number;
}

export interface CapacityForecast {
  day: string;
  capacity: number;
  load: number;
  utilization: number;
}
