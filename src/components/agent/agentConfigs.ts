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
import bizdevHelper from "@/assets/helpers/bizdev-helper.png";
import webbuilderHelper from "@/assets/helpers/webbuilder-helper.png";
import assistantHelper from "@/assets/helpers/assistant-helper.png";
import copywritingHelper from "@/assets/helpers/copywriting-helper.png";
import talentHelper from "@/assets/helpers/talent-helper.png";
import seoHelper from "@/assets/helpers/seo-helper.png";
import growthHelper from "@/assets/helpers/growth-helper.png";
import eisenhowerHelper from "@/assets/helpers/eisenhower-helper.png";

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
    name: "Blitz",
    role: "Sales & Pipeline",
    image: salesHelper,
    agentType: "sales",
    greeting: "Hey! I'm Blitz, your lightning-fast Sales agent.",
    placeholder: "Ask about pipeline, leads, deals...",
    capabilities: ["Check pipeline status", "Create new leads", "Move deals between stages", "Draft follow-ups"],
  },
  support: {
    name: "Haven",
    role: "Customer Support",
    image: supportHelper,
    agentType: "support",
    greeting: "Hi! I'm Haven, your Customer Support agent.",
    placeholder: "Ask about customers, tickets, support...",
    capabilities: ["Look up customers", "View customer history", "Draft support responses", "Create tasks"],
  },
  accounting: {
    name: "Penny",
    role: "Accounting (50yr CPA)",
    image: socialHelper,
    agentType: "accounting",
    greeting: "Morning! Let's review your numbers — I've checked your emails and QuickBooks already.",
    placeholder: "Ask about invoices, collections, tasks, emails...",
    capabilities: ["Check overdue invoices", "Monitor your emails", "Create tasks", "QuickBooks sync", "AR aging reports", "Draft collection emails"],
  },
  legal: {
    name: "Tally",
    role: "Legal (55yr Ontario Lawyer)",
    image: accountingHelper, // TODO: replace with dedicated legal helper image
    agentType: "legal" as AgentType,
    greeting: "Hello! I'm Tally, your in-house Legal counsel with 55 years of Ontario practice.",
    placeholder: "Ask about contracts, compliance, liens, disputes...",
    capabilities: ["Contract review", "Construction lien advice", "Ontario compliance (ESA, OHSA, WSIB)", "Dispute guidance", "Insurance review", "Regulatory questions"],
  },
  estimating: {
    name: "Gauge",
    role: "Estimating",
    image: estimatingHelper,
    agentType: "estimation",
    greeting: "Hey! I'm Gauge, your precision Estimating agent.",
    placeholder: "Upload drawings or ask about estimates...",
    capabilities: ["Analyze drawings (PDF/DWG)", "Extract rebar quantities", "Calculate weights", "Produce takeoff reports"],
  },
  shopfloor: {
    name: "Forge",
    role: "Shop Floor Commander",
    image: shopfloorHelper,
    agentType: "support",
    greeting: "I'm Forge, your Shop Floor Commander. I manage machines, guide cage builds, and keep maintenance on schedule.",
    placeholder: "Ask about machines, cage builds, maintenance...",
    capabilities: ["Guide cage fabrication from drawings", "Machine maintenance timeline", "Monitor machine status", "Production scheduling"],
  },
  delivery: {
    name: "Atlas",
    role: "Deliveries",
    image: deliveryHelper,
    agentType: "support",
    greeting: "Hi! I'm Atlas, your Delivery navigator.",
    placeholder: "Ask about deliveries, routes, stops...",
    capabilities: ["Track deliveries", "Check routes", "Update stop status", "Coordinate drivers"],
  },
  email: {
    name: "Relay",
    role: "Email & Inbox",
    image: emailHelper,
    agentType: "support",
    greeting: "Hey! I'm Relay, your Email & Inbox agent.",
    placeholder: "Ask about emails, drafts, inbox...",
    capabilities: ["Summarize inbox", "Draft email replies", "Create tasks from emails", "Find important messages"],
  },
  social: {
    name: "Pixel",
    role: "Social Media",
    image: accountingHelper,
    agentType: "social",
    greeting: "Hi! I'm Pixel, your Social Media agent.",
    placeholder: "Ask about social posts, content ideas...",
    capabilities: ["Draft social posts", "Content calendar", "Hashtag suggestions", "Platform-specific content"],
  },
  eisenhower: {
    name: "Eisenhower Matrix",
    role: "Eisenhower Matrix",
    image: eisenhowerHelper,
    agentType: "eisenhower",
    greeting: "Hello! I'm your Eisenhower Matrix strategist. Let's prioritize what truly matters.",
    placeholder: "Tell me your tasks and I'll help you prioritize...",
    capabilities: ["Categorize tasks by urgency & importance", "Build your priority matrix", "Identify tasks to delegate or eliminate", "Focus on what matters most"],
  },
  data: {
    name: "Prism",
    role: "Data & Insights",
    image: dataHelper,
    agentType: "support",
    greeting: "Hello! I'm Prism, your Data & Insights agent.",
    placeholder: "Ask about reports, trends, analytics...",
    capabilities: ["Business analytics", "Generate reports", "Trend analysis", "KPI tracking"],
  },
  bizdev: {
    name: "Buddy",
    role: "Business Development",
    image: bizdevHelper,
    agentType: "bizdev",
    greeting: "Hey! I'm Buddy, your Business Development strategist.",
    placeholder: "Ask about growth strategies, partnerships, market opportunities...",
    capabilities: ["Identify new markets", "Partnership strategies", "Competitor analysis", "Growth planning"],
  },
  webbuilder: {
    name: "Commet",
    role: "Web Builder",
    image: webbuilderHelper,
    agentType: "webbuilder",
    greeting: "Hi! I'm Commet, your Web Builder agent.",
    placeholder: "Ask about website updates, landing pages, SEO...",
    capabilities: ["Website content updates", "Landing page copy", "Technical SEO fixes", "Performance optimization"],
  },
  assistant: {
    name: "Vizzy",
    role: "CEO Assistant",
    image: assistantHelper,
    agentType: "assistant",
    greeting: "Hello! I'm Vizzy, your executive command assistant. I monitor all departments and flag what needs your attention.",
    placeholder: "Ask about business health, exceptions, cross-department status...",
    capabilities: ["Business health overview", "Exception-based reporting", "Cross-department coordination", "Executive briefings"],
  },
  copywriting: {
    name: "Penn",
    role: "Copywriting",
    image: copywritingHelper,
    agentType: "copywriting",
    greeting: "Hey! I'm Penn, your professional Copywriter.",
    placeholder: "Ask for proposals, emails, website copy, ads...",
    capabilities: ["Write proposals", "Marketing copy", "Email campaigns", "Product descriptions"],
  },
  talent: {
    name: "Scouty",
    role: "Talent & HR",
    image: talentHelper,
    agentType: "talent",
    greeting: "Hi! I'm Scouty, your Talent & HR agent.",
    placeholder: "Ask about hiring, onboarding, team management...",
    capabilities: ["Job descriptions", "Interview questions", "Onboarding checklists", "Team performance reviews"],
  },
  seo: {
    name: "Seomi",
    role: "SEO & Search",
    image: seoHelper,
    agentType: "seo",
    greeting: "Hello! I'm Seomi, your SEO specialist.",
    placeholder: "Ask about rankings, keywords, search performance...",
    capabilities: ["Keyword research", "On-page SEO audit", "Content optimization", "Search Console insights"],
  },
  growth: {
    name: "Gigi",
    role: "Personal Development",
    image: growthHelper,
    agentType: "growth",
    greeting: "Hi! I'm Gigi, your Personal Development coach.",
    placeholder: "Ask about goals, habits, productivity, learning...",
    capabilities: ["Goal setting & tracking", "Productivity tips", "Skill development plans", "Work-life balance"],
  },
};
