import type { AgentSuggestion } from "./AgentSuggestions";

export const agentSuggestions: Record<string, AgentSuggestion[]> = {
  sales: [
    { title: "Show my pipeline summary", category: "Pipeline" },
    { title: "Find leads closing this month", category: "Leads" },
    { title: "Draft a follow-up for my top deals", category: "Outreach" },
  ],
  support: [
    { title: "Show recent customer issues", category: "Support" },
    { title: "Draft a response to an open ticket", category: "Tickets" },
    { title: "Find customers with overdue tasks", category: "CRM" },
  ],
  accounting: [
    { title: "Check outstanding invoices", category: "Invoices" },
    { title: "Show overdue balances", category: "Collections" },
    { title: "Create a new estimate", category: "Quotes" },
  ],
  estimating: [
    { title: "Start a new takeoff from drawings", category: "Takeoff" },
    { title: "Calculate rebar for a slab", category: "Estimating" },
    { title: "Review my recent estimates", category: "Reports" },
  ],
  shopfloor: [
    { title: "Show today's work orders", category: "Production" },
    { title: "Check machine availability", category: "Shop Floor" },
    { title: "Find delayed jobs", category: "Scheduling" },
  ],
  delivery: [
    { title: "Show today's delivery routes", category: "Routing" },
    { title: "Track active deliveries", category: "Tracking" },
    { title: "Check tomorrow's schedule", category: "Planning" },
  ],
  email: [
    { title: "Summarize today's emails", category: "Inbox" },
    { title: "Draft a reply to the latest email", category: "Compose" },
    { title: "Find emails needing action", category: "Tasks" },
  ],
  social: [
    { title: "Draft a LinkedIn post", category: "Content" },
    { title: "Plan this week's social content", category: "Calendar" },
    { title: "Show post performance", category: "Analytics" },
  ],
  data: [
    { title: "Show business KPIs this month", category: "Analytics" },
    { title: "Compare this week vs last week", category: "Trends" },
    { title: "Generate a sales report", category: "Reports" },
  ],
};
