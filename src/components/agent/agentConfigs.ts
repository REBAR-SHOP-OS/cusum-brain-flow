import { AgentType } from "@/lib/agent";

// Agent helper images
import salesHelper from "@/assets/helpers/sales-helper.png";
import supportHelper from "@/assets/helpers/support-helper.png";
import accountingHelper from "@/assets/helpers/accounting-helper.png";
import estimatingHelper from "@/assets/helpers/estimating-helper.png";
import shopfloorHelper from "@/assets/helpers/shopfloor-helper.png";
import deliveryHelper from "@/assets/helpers/delivery-helper.png";
import emailHelper from "@/assets/helpers/email-helper.png";
import dataHelper from "@/assets/helpers/data-helper.png";
import socialHelper from "@/assets/helpers/social-helper.png";

export interface AgentConfig {
  name: string;
  role: string;
  image: string;
  agentType: AgentType;
  greeting: string;
  placeholder: string;
  capabilities: string[];
}

export const agentConfigs: Record<string, AgentConfig> = {
  sales: {
    name: "Salesy",
    role: "Sales & Pipeline",
    image: salesHelper,
    agentType: "sales",
    greeting: "Hey! I'm Salesy, your Sales & Pipeline agent.",
    placeholder: "Ask about pipeline, leads, deals...",
    capabilities: ["Check pipeline status", "Create new leads", "Move deals between stages", "Draft follow-ups"],
  },
  support: {
    name: "Sasha",
    role: "Customer Support",
    image: supportHelper,
    agentType: "support",
    greeting: "Hi! I'm Sasha, your Customer Support agent.",
    placeholder: "Ask about customers, tickets, support...",
    capabilities: ["Look up customers", "View customer history", "Draft support responses", "Create tasks"],
  },
  accounting: {
    name: "Archie",
    role: "Accounting",
    image: accountingHelper,
    agentType: "accounting",
    greeting: "Hello! I'm Archie, your Accounting agent.",
    placeholder: "Ask about invoices, estimates, financials...",
    capabilities: ["Check invoices", "Create estimates", "QuickBooks sync", "Financial summaries"],
  },
  estimating: {
    name: "Eddie",
    role: "Estimating",
    image: estimatingHelper,
    agentType: "estimation",
    greeting: "Hey! I'm Eddie, your Rebar Estimating agent.",
    placeholder: "Upload drawings or ask about estimates...",
    capabilities: ["Analyze drawings (PDF/DWG)", "Extract rebar quantities", "Calculate weights", "Produce takeoff reports"],
  },
  shopfloor: {
    name: "Steely",
    role: "Shop Floor",
    image: shopfloorHelper,
    agentType: "support",
    greeting: "I'm Steely, your Shop Floor agent.",
    placeholder: "Ask about work orders, production...",
    capabilities: ["Track work orders", "Check machine status", "View production schedule", "Report issues"],
  },
  delivery: {
    name: "Danny",
    role: "Deliveries",
    image: deliveryHelper,
    agentType: "support",
    greeting: "Hi! I'm Danny, your Delivery agent.",
    placeholder: "Ask about deliveries, routes, stops...",
    capabilities: ["Track deliveries", "Check routes", "Update stop status", "Coordinate drivers"],
  },
  email: {
    name: "Emmy",
    role: "Email & Inbox",
    image: emailHelper,
    agentType: "support",
    greeting: "Hey! I'm Emmy, your Email & Inbox agent.",
    placeholder: "Ask about emails, drafts, inbox...",
    capabilities: ["Summarize inbox", "Draft email replies", "Create tasks from emails", "Find important messages"],
  },
  social: {
    name: "Sushie",
    role: "Social Media",
    image: socialHelper,
    agentType: "social",
    greeting: "Hi! I'm Sushie, your Social Media agent.",
    placeholder: "Ask about social posts, content ideas...",
    capabilities: ["Draft social posts", "Content calendar", "Hashtag suggestions", "Platform-specific content"],
  },
  data: {
    name: "Dexter",
    role: "Data & Insights",
    image: dataHelper,
    agentType: "support",
    greeting: "Hello! I'm Dexter, your Data & Insights agent.",
    placeholder: "Ask about reports, trends, analytics...",
    capabilities: ["Business analytics", "Generate reports", "Trend analysis", "KPI tracking"],
  },
};
