import { Step } from "react-joyride";
import type { AppRole } from "@/hooks/useUserRole";

/** Shared steps every role sees */
const commonSteps: Step[] = [
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "🎉 Welcome to REBAR SHOP OS!",
    content:
      "Quick 60-second walkthrough — short, visual, zero fluff. Let's go!",
  },
  {
    target: '[data-tour="sidebar"]',
    placement: "right",
    title: "📍 Navigation",
    content: "Hover to expand. Everything you need lives here.",
  },
  {
    target: '[data-tour="topbar-search"]',
    placement: "bottom",
    title: "⚡ Command Bar (⌘K)",
    content: "Search anything — orders, customers, machines — instantly.",
  },
  {
    target: '[data-tour="topbar-user"]',
    placement: "bottom-end",
    title: "👤 Your Profile",
    content: "Settings, theme toggle, and sign-out live here.",
  },
];

const workshopSteps: Step[] = [
  {
    target: '[data-tour="nav-shop-floor"]',
    placement: "right",
    title: "🏭 Shop Floor",
    content:
      "Your home base. View live machine status, production queues, and station dashboards.",
  },
  {
    target: '[data-tour="nav-tasks"]',
    placement: "right",
    title: "✅ Tasks",
    content: "Your daily work orders and assignments land here.",
  },
  {
    target: "body",
    placement: "center",
    title: "🔥 You're Ready!",
    content:
      "Head to Shop Floor to see your station. Tap any machine to start cutting. Let's build! 💪",
  },
];

const officeSteps: Step[] = [
  {
    target: '[data-tour="nav-inbox"]',
    placement: "right",
    title: "📬 Inbox",
    content: "Emails, calls, and SMS — all in one place. AI summaries included.",
  },
  {
    target: '[data-tour="nav-pipeline"]',
    placement: "right",
    title: "📊 Pipeline",
    content: "Track every deal from lead to closed. Drag cards between stages.",
  },
  {
    target: '[data-tour="nav-customers"]',
    placement: "right",
    title: "👥 Customers",
    content: "Full customer profiles with order history and contacts.",
  },
  {
    target: '[data-tour="nav-office-portal"]',
    placement: "right",
    title: "🏢 Office Portal",
    content: "Production tags, packing slips, inventory — your command center.",
  },
  {
    target: "body",
    placement: "center",
    title: "🎯 You're Set!",
    content:
      "Check your Inbox first — then jump into Pipeline to see today's deals. Go crush it! 🚀",
  },
];

const adminSteps: Step[] = [
  {
    target: '[data-tour="nav-inbox"]',
    placement: "right",
    title: "📬 Inbox",
    content: "All communications flow here. AI highlights what matters.",
  },
  {
    target: '[data-tour="nav-shop-floor"]',
    placement: "right",
    title: "🏭 Shop Floor",
    content: "Live view of every machine, operator, and production queue.",
  },
  {
    target: '[data-tour="nav-pipeline"]',
    placement: "right",
    title: "📊 Pipeline",
    content: "Full sales pipeline visibility. Track revenue in real-time.",
  },
  {
    target: '[data-tour="nav-admin"]',
    placement: "right",
    title: "🛡️ Admin Panel",
    content: "User management, machine config, and system health — your controls.",
  },
  {
    target: '[data-tour="nav-brain"]',
    placement: "right",
    title: "🧠 Brain",
    content: "Knowledge base the AI agents use. Add docs, rules, and SOPs here.",
  },
  {
    target: "body",
    placement: "center",
    title: "👑 Boss Mode Activated!",
    content:
      "You see everything. Start with the Dashboard for today's snapshot. Let's run this shop! 🔥",
  },
];

const fieldSteps: Step[] = [
  {
    target: '[data-tour="nav-deliveries"]',
    placement: "right",
    title: "🚚 Deliveries",
    content: "Your route, stops, and proof-of-delivery — all here.",
  },
  {
    target: '[data-tour="nav-tasks"]',
    placement: "right",
    title: "✅ Tasks",
    content: "Pickup and delivery assignments from dispatch.",
  },
  {
    target: "body",
    placement: "center",
    title: "🛣️ Hit the Road!",
    content:
      "Check Deliveries for today's route. Mark each stop complete as you go. Safe travels! 🚛",
  },
];

const salesSteps: Step[] = [
  {
    target: '[data-tour="nav-pipeline"]',
    placement: "right",
    title: "📊 Pipeline",
    content: "Your deals live here. Drag to advance, click to dig in.",
  },
  {
    target: '[data-tour="nav-customers"]',
    placement: "right",
    title: "👥 Customers",
    content: "Customer contacts, history, and notes — everything in one spot.",
  },
  {
    target: '[data-tour="nav-inbox"]',
    placement: "right",
    title: "📬 Inbox",
    content: "Emails and calls from customers land here automatically.",
  },
  {
    target: "body",
    placement: "center",
    title: "💰 Time to Sell!",
    content:
      "Jump into Pipeline and start moving deals. Your AI helper Blitz is always ready to assist! 🎯",
  },
];

/** Get the right steps for a user's primary role */
export function getTourSteps(roles: AppRole[]): Step[] {
  // Priority: admin > workshop > office/sales > field > default office
  if (roles.includes("admin")) return [...commonSteps, ...adminSteps];
  if (roles.includes("workshop")) return [...commonSteps, ...workshopSteps];
  if (roles.includes("sales")) return [...commonSteps, ...salesSteps];
  if (roles.includes("office") || roles.includes("accounting"))
    return [...commonSteps, ...officeSteps];
  if (roles.includes("field")) return [...commonSteps, ...fieldSteps];
  // Fallback
  return [...commonSteps, ...officeSteps];
}
