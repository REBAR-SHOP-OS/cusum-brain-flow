import { Step } from "react-joyride";
import type { AppRole } from "@/hooks/useUserRole";

/* ────────────────────────────────────────────
   SHARED – Every role sees these first
   ──────────────────────────────────────────── */
const welcome: Step[] = [
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    title: "🎉 Welcome to REBAR SHOP OS!",
    content:
      "This is your training walkthrough. It takes ~3 minutes and will teach you everything you need to do your job. Short steps, big emojis, zero fluff. Ready?",
  },
];

const coreNav: Step[] = [
  {
    target: '[data-tour="sidebar"]',
    placement: "right",
    title: "📍 Your Sidebar",
    content:
      "This is your navigation hub. Hover to expand it and see labels. Every section of the app lives here — organized by what you do.",
  },
  {
    target: '[data-tour="topbar-search"]',
    placement: "bottom",
    title: "⚡ Command Bar (⌘K)",
    content:
      "Type anything here — customer names, order numbers, machine IDs. It searches EVERYTHING instantly. Pro tip: hit ⌘K (or Ctrl+K) from anywhere.",
  },
  {
    target: '[data-tour="topbar-user"]',
    placement: "bottom-end",
    title: "👤 Your Profile & Settings",
    content:
      "Click here to change your avatar, switch themes (dark/light), update your language, or sign out. Your profile picture shows up everywhere — make it yours!",
  },
  {
    target: '[data-tour="nav-dashboard"]',
    placement: "right",
    title: "🏠 Dashboard — Your Home Base",
    content:
      "This is where you start every day. Quick actions, AI helpers, and a chat bar to ask anything about your business. Think of it as your morning briefing.",
  },
];

/* ────────────────────────────────────────────
   WORKSHOP ROLE — Machine operators & floor staff
   ──────────────────────────────────────────── */
const workshopSteps: Step[] = [
  {
    target: '[data-tour="nav-shop-floor"]',
    placement: "right",
    title: "🏭 Shop Floor — YOUR Main Screen",
    content:
      "This is where you'll spend 90% of your time. It shows every machine in the shop, what's running, what's queued, and what needs attention.",
  },
  {
    target: "body",
    placement: "center",
    title: "🔧 How Stations Work",
    content:
      "Each machine has a Station View. When you tap a machine, you see: ① What to cut/bend next ② Bar size & length ③ How many pieces ④ Where to send finished work (Bender or Pickup). Follow the colored paths: 🟠 Orange = Cut & Bend | 🔵 Blue = Straight Cut → Bundle.",
  },
  {
    target: "body",
    placement: "center",
    title: "✂️ Cutter Station — Step by Step",
    content:
      "1️⃣ Select your machine from Station Dashboard\n2️⃣ See the next item in queue (bar size, cut length, pieces)\n3️⃣ Load the bars as instructed\n4️⃣ Hit START to begin the run\n5️⃣ When done, system tells you: SEND TO BENDER or BUNDLE → PICKUP\n6️⃣ Next item loads automatically after 1.2 seconds!",
  },
  {
    target: "body",
    placement: "center",
    title: "🔨 Bender Station — Piece by Piece",
    content:
      "Unlike the Cutter, the Bender tracks each piece individually. Select an item from the bed grid → confirm each piece as you bend it → system tracks your progress automatically. No Start/Stop buttons — just tap to confirm each piece.",
  },
  {
    target: "body",
    placement: "center",
    title: "📏 Reading Cut Plan Items",
    content:
      "Every item shows: Mark Number (e.g. M-101), Drawing Ref, Bar Code (N12, N16, etc.), Cut Length in mm, Total Pieces, and Bend Type. For bends, you'll also see the ASA Shape Code and dimension letters (A, B, C...). Always match these to your setup before starting!",
  },
  {
    target: '[data-tour="nav-tasks"]',
    placement: "right",
    title: "✅ Tasks — Your Daily Assignments",
    content:
      "Your foreman or dispatch assigns work orders here. Check this at the start of every shift for priority changes. Completed tasks auto-update when machine runs finish.",
  },
  {
    target: "body",
    placement: "center",
    title: "⚠️ Important Safety Rules",
    content:
      "🔴 NEVER start a machine run without verifying bar size matches the plan\n🔴 If a cut plan shows 'NEEDS FIX' flag, STOP and alert your supervisor\n🔴 Always confirm piece count before marking complete\n🔴 Report any machine issues through the system — it logs everything",
  },
  {
    target: "body",
    placement: "center",
    title: "💪 You're Trained!",
    content:
      "Head to Shop Floor → pick your machine → start your first run. The system guides you step by step. If anything looks wrong, ask your foreman or use ⌘K to search for help. Let's build! 🔥",
  },
];

/* ────────────────────────────────────────────
   OFFICE ROLE — Sales, Accounting, Admin Assistants
   ──────────────────────────────────────────── */
const officeSteps: Step[] = [
  {
    target: '[data-tour="nav-inbox"]',
    placement: "right",
    title: "📬 Inbox — Your Communication Hub",
    content:
      "ALL emails, phone calls, and SMS messages arrive here in one unified feed. Tabs at the top filter by type. AI automatically summarizes long email threads so you don't have to read every word.",
  },
  {
    target: "body",
    placement: "center",
    title: "📧 Working with Emails",
    content:
      "Click any email to read it → Reply inline → AI can draft responses for you. Use the action bar to: Archive, Star, Create Task from email, or Forward. Every email is linked to a customer record automatically when possible.",
  },
  {
    target: '[data-tour="nav-pipeline"]',
    placement: "right",
    title: "📊 Pipeline — Track Every Deal",
    content:
      "Kanban board showing all deals by stage: Lead → Quoted → Negotiating → Won/Lost. Drag cards between columns to update status. Click a card to see full details, notes, and history.",
  },
  {
    target: "body",
    placement: "center",
    title: "💰 Managing Leads",
    content:
      "To add a new lead: click '+ New Lead' → fill in customer, expected value, and close date. Assign it to a sales rep. The system tracks probability and shows your forecast automatically. Every update logs to history.",
  },
  {
    target: '[data-tour="nav-customers"]',
    placement: "right",
    title: "👥 Customers — Full Contact Database",
    content:
      "Every customer with contacts, order history, credit limits, and notes. Click any customer to see their full profile. Add new customers, link contacts, and track payment terms here.",
  },
  {
    target: '[data-tour="nav-office-portal"]',
    placement: "right",
    title: "🏢 Office Portal — Production Oversight",
    content:
      "Your window into the shop floor WITHOUT being on the shop floor. View production tags, packing slips, inventory levels, CEO dashboard, and AI-extracted data. You can see everything but only Workshop users can operate machines.",
  },
  {
    target: "body",
    placement: "center",
    title: "📋 Packing Slips & Tags",
    content:
      "Inside Office Portal: generate rebar tags for bundles, create packing slips for deliveries, and export data. The system auto-populates from cut plan data — no manual entry needed.",
  },
  {
    target: '[data-tour="nav-calls"]',
    placement: "right",
    title: "📞 Phone Calls",
    content:
      "RingCentral integration shows all calls with AI transcripts and summaries. Click any call to see who called, when, key topics discussed, and action items extracted by AI.",
  },
  {
    target: "body",
    placement: "center",
    title: "🤖 Your AI Helpers",
    content:
      "From the Dashboard, you have AI agents: Blitz (Sales), Penny (Accounting), Tally (Legal), Haven (Support), and more. Chat with them naturally — they know your data. Ask 'What invoices are overdue?' or 'Draft a follow-up email to ABC Corp'.",
  },
  {
    target: "body",
    placement: "center",
    title: "🎯 You're Ready!",
    content:
      "Start your day: Check Inbox → Review Pipeline → Handle customer requests. Your AI helpers are one click away on the Dashboard. Go crush it! 🚀",
  },
];

/* ────────────────────────────────────────────
   ADMIN ROLE — Full system access
   ──────────────────────────────────────────── */
const adminSteps: Step[] = [
  {
    target: '[data-tour="nav-inbox"]',
    placement: "right",
    title: "📬 Inbox — Company-Wide Communications",
    content:
      "As admin, you see ALL communications across the company. Emails, calls, SMS — everything flows here with AI summaries. Use filters to focus on what matters.",
  },
  {
    target: '[data-tour="nav-shop-floor"]',
    placement: "right",
    title: "🏭 Shop Floor — Full Production Control",
    content:
      "You have FULL access to every machine. View live status, operator assignments, production queues, and machine runs. You can start/stop runs, reassign work, and override priorities.",
  },
  {
    target: "body",
    placement: "center",
    title: "🖥️ Station Management",
    content:
      "Click any machine → see its current job, queue depth, operator, and performance metrics. You can: transfer jobs between machines, pause production, flag items for review, and view historical run data.",
  },
  {
    target: "body",
    placement: "center",
    title: "📊 Production Flow Overview",
    content:
      "The production system uses two color-coded paths:\n🟠 Orange Path = Cut & Bend (goes Cutter → Bender → Pickup)\n🔵 Blue Path = Straight Cut (goes Cutter → Bundle → Pickup)\nItems are grouped by bar size in 'Size Reservoirs' for efficient machine loading.",
  },
  {
    target: '[data-tour="nav-pipeline"]',
    placement: "right",
    title: "📊 Pipeline — Revenue Tracking",
    content:
      "Full visibility into every deal. See total pipeline value, expected close dates, and win probability. Filter by sales rep, customer, or date range.",
  },
  {
    target: '[data-tour="nav-customers"]',
    placement: "right",
    title: "👥 Customers — Complete CRM",
    content:
      "Full customer database with QuickBooks sync support. Credit limits, payment terms, contacts, and order history. You control access — Office users can view, only Admin can delete.",
  },
  {
    target: '[data-tour="nav-office-portal"]',
    placement: "right",
    title: "🏢 Office Portal — Command Center",
    content:
      "Production tags, packing slips, inventory management, CEO dashboard with KPIs, AI data extraction, payroll audit, and diagnostic logs. This is your operational control panel.",
  },
  {
    target: "body",
    placement: "center",
    title: "📦 Inventory System",
    content:
      "Track raw material by bar code and lot number. The system manages: Stock on Hand, Reserved Quantities, Floor Stock (at machines), Cut Output Batches, and Scrap. Reservations auto-create when cut plans are queued.",
  },
  {
    target: '[data-tour="nav-deliveries"]',
    placement: "right",
    title: "🚚 Deliveries — Logistics Control",
    content:
      "Create delivery routes with stops, assign drivers and vehicles. Track proof-of-delivery with photos and signatures. Monitor live delivery status and handle exceptions.",
  },
  {
    target: '[data-tour="nav-admin"]',
    placement: "right",
    title: "🛡️ Admin Panel — System Control",
    content:
      "User management, role assignments (Admin/Office/Workshop/Field), machine configuration, database audits, and cleanup reports. Only you can access this section.",
  },
  {
    target: "body",
    placement: "center",
    title: "👥 Role-Based Access Control",
    content:
      "The system enforces strict roles:\n👑 Admin — Full control over everything\n🏢 Office — Read-only on production, full on sales/CRM\n🔧 Workshop — Machine operations only\n🚛 Field — Delivery operations only\nNever share admin credentials. Each person gets their own account.",
  },
  {
    target: '[data-tour="nav-brain"]',
    placement: "right",
    title: "🧠 Brain — AI Knowledge Base",
    content:
      "This is what powers your AI helpers. Add SOPs, product specs, pricing rules, and company policies. The more you feed it, the smarter your agents become. Upload documents or type directly.",
  },
  {
    target: '[data-tour="nav-settings"]',
    placement: "right",
    title: "⚙️ Settings — Your Profile",
    content:
      "Update your name, avatar, language preferences, and theme. Manage billing and subscription. You can also replay this training tour anytime from Settings!",
  },
  {
    target: "body",
    placement: "center",
    title: "🤖 AI Agents — Your Executive Team",
    content:
      "10 AI agents available from Dashboard:\n⚡ Blitz (Sales) • 🛡️ Haven (Support) • 💰 Penny (Accounting) • ⚖️ Tally (Legal)\n📐 Gauge (Estimating) • 🔨 Forge (Shop Floor) • 🗺️ Atlas (Deliveries)\n📧 Relay (Email) • 📱 Pixel (Social) • 🔮 Prism (Data)\nChat naturally — they access your real data.",
  },
  {
    target: "body",
    placement: "center",
    title: "👑 You're the Boss!",
    content:
      "Daily routine: Dashboard → Inbox → Pipeline → Shop Floor spot-check. Use ⌘K to jump anywhere fast. Your AI agents handle the rest. You see everything, you control everything. Run this shop! 🔥",
  },
];

/* ────────────────────────────────────────────
   FIELD ROLE — Delivery drivers & field staff
   ──────────────────────────────────────────── */
const fieldSteps: Step[] = [
  {
    target: '[data-tour="nav-deliveries"]',
    placement: "right",
    title: "🚚 Deliveries — Your Main Screen",
    content:
      "This is where you'll spend most of your time. See today's routes, delivery stops, and customer addresses. Each stop shows what needs to be delivered and any special instructions.",
  },
  {
    target: "body",
    placement: "center",
    title: "📋 Delivery Workflow",
    content:
      "1️⃣ Check your assigned route for the day\n2️⃣ Review each stop: address, customer name, order details\n3️⃣ Navigate to the stop\n4️⃣ Deliver the material\n5️⃣ Capture proof: take a photo + get signature\n6️⃣ Mark stop as COMPLETE\n7️⃣ If there's a problem → Mark as EXCEPTION with reason",
  },
  {
    target: "body",
    placement: "center",
    title: "📸 Proof of Delivery",
    content:
      "For EVERY stop, you MUST:\n📷 Take a photo of the delivered material at the site\n✍️ Get the customer's signature on screen\n📝 Add any notes (e.g., 'Left at loading dock per customer request')\nThis protects the company and prevents disputes.",
  },
  {
    target: "body",
    placement: "center",
    title: "⚠️ Handling Exceptions",
    content:
      "If you can't deliver:\n🔴 Customer not available → Mark exception, note the time you arrived\n🔴 Wrong material → Take photo, mark exception, call dispatch\n🔴 Site access issue → Note the problem, take photo, move to next stop\nNEVER leave material without confirmation!",
  },
  {
    target: '[data-tour="nav-tasks"]',
    placement: "right",
    title: "✅ Tasks — Pickup Assignments",
    content:
      "Dispatch assigns pickup tasks here too. Check this for: customer pickups at the yard, material transfers between locations, and special delivery instructions.",
  },
  {
    target: '[data-tour="nav-calls"]',
    placement: "right",
    title: "📞 Calls — Stay Connected",
    content:
      "Call customers directly from the app if you need directions or can't find the site. All calls are logged automatically so dispatch can see your communication history.",
  },
  {
    target: "body",
    placement: "center",
    title: "🛣️ You're Ready to Roll!",
    content:
      "Morning routine: Check Deliveries → Review route → Load truck → Hit the road. Mark every stop complete with photo + signature. Report problems immediately. Safe travels! 🚛💨",
  },
];

/* ────────────────────────────────────────────
   SALES ROLE — Sales reps & estimators
   ──────────────────────────────────────────── */
const salesSteps: Step[] = [
  {
    target: '[data-tour="nav-pipeline"]',
    placement: "right",
    title: "📊 Pipeline — Your Revenue Engine",
    content:
      "Kanban board with all your deals. Stages: Lead → Quoted → Negotiating → Won/Lost. Drag cards to update. Click to see full details. Your forecast updates automatically based on probability × value.",
  },
  {
    target: "body",
    placement: "center",
    title: "➕ Creating & Managing Leads",
    content:
      "To create a lead:\n1️⃣ Click '+ New Lead' in Pipeline\n2️⃣ Select or create customer\n3️⃣ Enter expected value and close date\n4️⃣ Set probability (affects forecast)\n5️⃣ Add notes and source (referral, website, cold call)\nUpdate regularly — your manager sees this!",
  },
  {
    target: '[data-tour="nav-customers"]',
    placement: "right",
    title: "👥 Customers — Your Contact Book",
    content:
      "Full customer profiles: company info, contacts (with roles), order history, credit limits, and payment terms. Always check existing customers before creating duplicates!",
  },
  {
    target: "body",
    placement: "center",
    title: "👤 Customer Best Practices",
    content:
      "When adding customers:\n✅ Always fill in company name AND contact name\n✅ Add email and phone for primary contact\n✅ Note payment terms if discussed\n✅ Link related contacts (engineer, project manager, AP)\n❌ Don't create duplicate customers — search first!",
  },
  {
    target: '[data-tour="nav-inbox"]',
    placement: "right",
    title: "📬 Inbox — Customer Communications",
    content:
      "All emails and calls from customers land here. AI summarizes long threads. You can reply inline, create tasks from emails, and the system auto-links messages to customer records.",
  },
  {
    target: "body",
    placement: "center",
    title: "📧 Email Best Practices",
    content:
      "When handling customer emails:\n1️⃣ Read the AI summary first (saves time!)\n2️⃣ Check if it's linked to a pipeline deal\n3️⃣ Reply using the inline composer\n4️⃣ If it needs follow-up → Create a Task\n5️⃣ Star important emails for quick access later",
  },
  {
    target: '[data-tour="nav-calls"]',
    placement: "right",
    title: "📞 Calls — AI Transcripts",
    content:
      "Every call gets an AI transcript and summary. Key topics and action items are extracted automatically. Review call notes before following up — it shows you exactly what was promised.",
  },
  {
    target: "body",
    placement: "center",
    title: "🤖 Your AI Sales Assistant — Blitz",
    content:
      "From Dashboard → click Blitz (Sales agent). Ask things like:\n💬 'What deals are closing this week?'\n💬 'Draft a follow-up for ABC Corp'\n💬 'Show me pipeline by customer type'\nBlitz knows your real data — use it!",
  },
  {
    target: "body",
    placement: "center",
    title: "💰 You're Ready to Sell!",
    content:
      "Daily routine: Inbox → Pipeline → Follow-ups → Customer calls. Keep your pipeline updated — it drives company forecasting. Use Blitz for drafts and data questions. Go close some deals! 🎯🔥",
  },
];

/* ────────────────────────────────────────────
   BUILDER – assemble steps by role
   ──────────────────────────────────────────── */
export function getTourSteps(roles: AppRole[]): Step[] {
  if (roles.includes("admin")) return [...welcome, ...coreNav, ...adminSteps];
  if (roles.includes("workshop")) return [...welcome, ...coreNav, ...workshopSteps];
  if (roles.includes("sales")) return [...welcome, ...coreNav, ...salesSteps];
  if (roles.includes("office") || roles.includes("accounting"))
    return [...welcome, ...coreNav, ...officeSteps];
  if (roles.includes("field")) return [...welcome, ...coreNav, ...fieldSteps];
  return [...welcome, ...coreNav, ...officeSteps];
}
