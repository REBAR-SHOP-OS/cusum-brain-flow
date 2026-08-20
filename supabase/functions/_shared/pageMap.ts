/**
 * Complete navigation map of REBAR SHOP OS.
 * Used by AI agents to be page-aware and guide users to the right place.
 */
export const PAGE_MAP: Record<string, { name: string; description: string }> = {
  "/home": { name: "Home / Dashboard", description: "Quick actions, AI agent cards, daily briefing, announcements" },
  "/ceo": { name: "CEO Portal", description: "Executive overview — financials, production KPIs, team metrics, payroll" },
  "/inbox": { name: "Inbox", description: "Unified communications — emails, calls, SMS with AI triage & drafts" },
  "/tasks": { name: "Tasks", description: "Human tasks queue — items needing manual review or approval" },
  "/phonecalls": { name: "Phone Calls", description: "Call tasks, outbound dialer, AI transcripts, call outcomes" },
  "/pipeline": { name: "Sales Pipeline", description: "Kanban pipeline (Lead → Quoted → Negotiating → Won/Lost), lead management, RFQ processing" },
  "/prospecting": { name: "Prospecting", description: "Lead generation, outreach campaigns, prospect research" },
  "/customers": { name: "Customers", description: "CRM — contacts, credit limits, payment terms, QuickBooks sync, customer history" },
  "/accounting": { name: "Accounting", description: "Financial workspace — invoices, bills, payments, QuickBooks integration, GL transactions" },
  "/shop-floor": { name: "Shop Floor", description: "Production overview — machine stations, cut plans, work orders, production queues" },
  "/shopfloor/cutter": { name: "Cutter Planning", description: "Cut plan creation and management — bar sizes, cut lengths, shape codes" },
  "/shopfloor/station": { name: "Station Dashboard", description: "Machine station overview — all machines, their status, operators" },
  "/shopfloor/pool": { name: "Pool View", description: "Unassigned work items waiting to be picked up by operators" },
  "/shopfloor/pickup": { name: "Pickup Station", description: "Completed items ready for pickup and delivery assignment" },
  "/shopfloor/clearance": { name: "Clearance Station", description: "Material clearance verification with photo evidence and tag scans" },
  
  "/deliveries": { name: "Deliveries", description: "Route planning, delivery stops, proof-of-delivery (photo + signature), driver assignments" },
  "/timeclock": { name: "Time Clock", description: "Employee check-in/out with face recognition, shift tracking, attendance" },
  "/team-hub": { name: "Team Hub", description: "Team directory, presence, roles, quick messaging" },
  "/brain": { name: "Brain / Knowledge Base", description: "AI knowledge base — SOPs, pricing rules, company policies, training materials" },
  "/integrations": { name: "Integrations", description: "Third-party connections — QuickBooks, RingCentral, email, API keys" },
  "/settings": { name: "Settings", description: "Profile, theme, language, tour replay, notifications" },
  "/admin": { name: "Admin Panel", description: "User management, role assignments, system configuration" },
  "/admin/machines": { name: "Admin Machines", description: "Machine configuration — add/edit machines, types, capabilities" },
  "/admin/db-audit": { name: "DB Audit", description: "Database health checks and data integrity audits" },
  "/social-media-manager": { name: "Social Media", description: "Social media content management and scheduling" },
  "/email-marketing": { name: "Email Marketing", description: "Email campaigns, templates, audience segments, send tracking" },
  "/transcribe": { name: "Transcribe", description: "Audio/video transcription with AI summaries" },
  "/office": { name: "Office Portal", description: "Production tags, packing slips, inventory management, shipping labels" },
  "/chat": { name: "Vizzy Chat", description: "Full-screen AI chat with JARVIS (text mode)" },
  "/website": { name: "Website Manager", description: "AI-powered WordPress/WooCommerce editor for rebar.shop — edit posts, pages, products, SEO, redirects" },
};

export function buildPageContext(currentPage: string): string {
  const current = PAGE_MAP[currentPage];
  const currentInfo = current
    ? `📍 USER IS CURRENTLY ON: **${current.name}** (${currentPage}) — ${current.description}`
    : `📍 USER IS CURRENTLY ON: ${currentPage}`;

  const navList = Object.entries(PAGE_MAP)
    .map(([path, info]) => `  • [${info.name}](${path}) — ${info.description}`)
    .join("\n");

  return `${currentInfo}

═══ APP NAVIGATION MAP ═══
${navList}

═══ PAGE-AWARE INSTRUCTIONS ═══
- You know which page the user is on. If they ask about something on this page, help them directly.
- If what they're asking about is on a DIFFERENT page, tell them which page it's on and provide a clickable markdown link like: **[Go to ${current?.name || "that page"}](/path)**
- When giving step-by-step instructions, always mention which page each step happens on.
- If the user seems lost, suggest the right page with a link.
- Format navigation links as markdown links: [Page Name](/path) so they become clickable.`;
}
