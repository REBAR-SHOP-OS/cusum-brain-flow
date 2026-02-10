import type { ExceptionItem, ARAgingBucket, AtRiskJob, CapacityForecast } from "./types";

export const mockExceptions: ExceptionItem[] = [
  {
    id: "exc-1", category: "cash", severity: "critical",
    title: "Invoice #4821 overdue 45 days", detail: "Original amount $12,400 — no response to 3 follow-ups",
    owner: "Collections", age: "45d", customer: "Acme Builders", value: 12400,
    actions: [{ label: "Send Final Notice", type: "primary" }, { label: "Hold Orders", type: "secondary" }],
  },
  {
    id: "exc-2", category: "ops", severity: "warning",
    title: "Cutter-02 idle 3+ hours", detail: "No cut plan queued. Machine available but unproductive.",
    owner: "Foreman", age: "3h",
    actions: [{ label: "Assign Plan", type: "primary" }, { label: "Log Downtime", type: "secondary" }],
  },
  {
    id: "exc-3", category: "sales", severity: "info",
    title: "Quote #Q-189 expiring tomorrow", detail: "Est. value $8,200 — customer: Metro Rebar Supply",
    owner: "Sales", age: "6d", customer: "Metro Rebar Supply", value: 8200,
    actions: [{ label: "Follow Up", type: "primary" }, { label: "Extend Quote", type: "secondary" }],
  },
  {
    id: "exc-4", category: "delivery", severity: "warning",
    title: "DEL-044 delayed — driver reassigned", detail: "Original ETA missed. Customer notified.",
    owner: "Dispatch", age: "1d", customer: "Summit Steel",
    actions: [{ label: "Reschedule", type: "primary" }, { label: "Create Task", type: "secondary" }],
  },
  {
    id: "exc-5", category: "cash", severity: "warning",
    title: "Invoice #4790 overdue 22 days", detail: "Amount $6,100 — payment promised last week",
    owner: "Collections", age: "22d", customer: "Delta Rebar", value: 6100,
    actions: [{ label: "Call Customer", type: "primary" }, { label: "Create Task", type: "secondary" }],
  },
];

export const mockARAgingBuckets: ARAgingBucket[] = [
  { bucket: "Current", amount: 45200, count: 12 },
  { bucket: "1-30", amount: 38100, count: 9 },
  { bucket: "31-60", amount: 28400, count: 8 },
  { bucket: "61-90", amount: 18500, count: 4 },
  { bucket: "90+", amount: 11200, count: 2 },
];

export const mockAtRiskJobs: AtRiskJob[] = [
  { id: "j1", name: "Tower-A Foundation Rebar", customer: "Acme Builders", dueDate: "2026-02-14", daysLeft: 4, riskReason: "Material shortage — #5 bar", probability: 72 },
  { id: "j2", name: "Parking Garage Level 3", customer: "Metro Rebar", dueDate: "2026-02-16", daysLeft: 6, riskReason: "Capacity conflict on Bender-01", probability: 58 },
  { id: "j3", name: "Bridge Deck Reinforcement", customer: "Summit Steel", dueDate: "2026-02-13", daysLeft: 3, riskReason: "Waiting customer approval", probability: 45 },
];

export const mockCapacityForecast: CapacityForecast[] = [
  { day: "Mon", capacity: 100, load: 78, utilization: 78 },
  { day: "Tue", capacity: 100, load: 92, utilization: 92 },
  { day: "Wed", capacity: 100, load: 105, utilization: 105 },
  { day: "Thu", capacity: 100, load: 63, utilization: 63 },
  { day: "Fri", capacity: 100, load: 85, utilization: 85 },
  { day: "Sat", capacity: 50, load: 30, utilization: 60 },
  { day: "Sun", capacity: 0, load: 0, utilization: 0 },
];

export const mockAIExplainer = {
  what_changed: "Business Health dropped 4 points since yesterday, driven primarily by a 12% increase in overdue A/R and one machine going offline.",
  top_drivers: [
    "Overdue A/R increased 12% ($11.2K → $12.5K)",
    "Cutter-02 went offline at 9:14 AM (bearing issue)",
    "Pipeline velocity improved — 2 new qualified leads",
  ],
  recommended_actions: [
    { title: "Escalate Invoice #4821 (45 days overdue)", owner_suggestion: "Collections Team", impact: "high" as const },
    { title: "Schedule maintenance for Cutter-02", owner_suggestion: "Maintenance Lead", impact: "high" as const },
    { title: "Follow up on Quote #Q-189 (expiring tomorrow)", owner_suggestion: "Sales Rep", impact: "med" as const },
  ],
};
