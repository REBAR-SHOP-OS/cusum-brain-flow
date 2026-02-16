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
  eisenhower: [
    { title: "Help me prioritize my tasks for today", category: "Prioritize" },
    { title: "Which of my tasks should I delegate?", category: "Delegate" },
    { title: "Build an Eisenhower Matrix from my to-do list", category: "Matrix" },
  ],
  data: [
    { title: "Show business KPIs this month", category: "Analytics" },
    { title: "Compare this week vs last week", category: "Trends" },
    { title: "Generate a sales report", category: "Reports" },
  ],
  bizdev: [
    { title: "Analyze our market position", category: "Strategy" },
    { title: "Find new partnership opportunities", category: "Partnerships" },
    { title: "Draft a business growth plan", category: "Growth" },
  ],
  webbuilder: [
    { title: "Audit our job site for SEO issues", category: "SEO" },
    { title: "Suggest landing page improvements", category: "Web" },
    { title: "Write homepage copy for rebar.shop", category: "Content" },
  ],
  assistant: [
    { title: "What should I focus on today?", category: "Planning" },
    { title: "Summarize my pending tasks", category: "Tasks" },
    { title: "Draft a meeting agenda", category: "Organize" },
  ],
  copywriting: [
    { title: "Write a proposal for a rebar project", category: "Proposals" },
    { title: "Draft a marketing email campaign", category: "Email" },
    { title: "Write product descriptions for our services", category: "Marketing" },
  ],
  talent: [
    { title: "Write a job posting for a fabricator", category: "Hiring" },
    { title: "Create interview questions for a welder", category: "Interviews" },
    { title: "Draft an employee onboarding checklist", category: "Onboarding" },
  ],
  seo: [
    { title: "Audit the homepage SEO", category: "Audit" },
    { title: "Fix meta descriptions on all pages", category: "Fix" },
    { title: "Create a blog post about rebar sizes", category: "Content" },
  ],
  growth: [
    { title: "Help me set quarterly goals", category: "Goals" },
    { title: "How can I improve my productivity?", category: "Productivity" },
    { title: "Create a learning plan for my team", category: "Development" },
  ],
  empire: [
    { title: "I have a new business idea", category: "Create" },
    { title: "Show me all my ventures", category: "List" },
    { title: "Run a stress test on my latest venture", category: "Analyze" },
    { title: "What should I build next?", category: "Strategy" },
  ],
};
