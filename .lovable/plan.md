

# Generate REBAR SHOP OS Complete System Rebuild Blueprint

## What
Produce a reconstruction-grade Markdown document (`system-rebuild-blueprint.md`) covering all 30 required sections with implementation-level detail derived from the actual codebase.

## Scope Discovered

### System Scale
- **83 pages/routes** (53 protected, 10 public, 8 admin, 12 redirects)
- **193 edge functions** (192 on handleRequest pattern + 1 Hono-based MCP)
- **56 component directories** with 350+ components
- **130+ custom hooks**
- **21 AI agents** (Blitz, Haven, Penny, Tally, Gauge, Forge, Atlas, Relay, Pixel, Eisenhower, Prism, Buddy, Commet, Vizzy, Penn, Scouty, Seomi, Gigi, Architect, Kala, Nila)
- **8 user roles**: admin, sales, accounting, office, workshop, field, shop_supervisor, customer
- **3 super admins**: sattar@, radin@, zahra@rebar.shop
- **Dual AI providers**: OpenAI GPT + Google Gemini with circuit breaker, policy router, budget guardrails
- **Multi-tenant**: company_id scoping via profiles table + RLS

### Module Map (from routes + sidebar)
1. **Dashboard/Home** — KPI widgets, business heartbeat
2. **CEO Portal** — Health scores, exceptions, SLA tracker, briefings, fix request queue
3. **Live Monitor** — Real-time system monitoring
4. **Pipeline/CRM** — Kanban board, lead scoring, AI actions, bulk operations, prospecting
5. **Sales Department** — Hub, Pipeline, Quotations, Invoices, Contacts (new workspace)
6. **Customers** — Company/contact management, CRUD, communications
7. **Accounting** — Full QB-synced workspace (invoices, bills, payments, payroll, reconciliation, AP/AR aging, tax)
8. **Shop Floor** — Production queue, cutter planning, station views, pool view, machine registry, slot tracker
9. **Delivery/Logistics** — Loading station, pickup, delivery ops, delivery terminal, smart dispatch
10. **Office Portal** — Extract/import, barlist mapping, tags, optimization, payroll audit, production queue
11. **Time Clock** — Face recognition, leave management, payroll summary, team calendar
12. **Team Hub** — Chat channels, meetings, personal notes, DMs
13. **Social Media Manager** — Calendar, auto-generate, publish, approvals, Pixel AI agent
14. **Video Studio** — Video generation, editing, insights, video-to-social
15. **Ad Director** — Script→storyboard→video pipeline, 43 components, 14 AI task types
16. **Email Marketing** — Campaigns, automations, analytics, suppression
17. **Facebook Commenter** — Manual/AI commenting
18. **SEO Module** — Keywords, pages, links, local, copilot, AI visibility
19. **Website Manager** — WordPress management, speed audit, chat widget
20. **Empire Builder** — Venture creation, AI stress tests, cross-platform diagnostics
21. **Estimation** — Drawing analysis, takeoff, BOM, OCR QA
22. **Quote Engine** — Quote generation, templates, public view, acceptance
23. **Integrations** — QuickBooks, RingCentral, Gmail, Facebook, LinkedIn, TikTok, Stripe, Odoo, Synology
24. **Brain/Knowledge** — Document embeddings, search
25. **Agent Workspace** — 21 specialized AI agents with tool calling
26. **Support Inbox** — Customer support, knowledge base, chat widget
27. **Automations Hub** — Pipeline automations, scheduled tasks
28. **Admin Panel** — DB audit, machines, cleanup, connections, waste bank, bend queue, bundles, production audit
29. **Settings** — User preferences, notification settings
30. **Autopilot** — Multi-step autonomous operations
31. **Clearance Station** — QC/clearance workflow
32. **Inventory** — Count management, status tracking
33. **Camera Intelligence** — Face recognition, vision analysis
34. **Transcribe** — Audio transcription, live watch
35. **Org Chart** — Team hierarchy
36. **QA War Engine** — Quality assurance campaigns
37. **App Builder** — Internal app scaffolding

### Backend Architecture
- **Auth**: Supabase Auth (JWT), email/password, onAuthStateChange listener
- **Shared modules**: requestHandler.ts (CORS, auth, company resolution, role check), aiRouter.ts (dual-provider GPT/Gemini with circuit breaker), writeEvent.ts (activity ledger), resolveCompany.ts (cached company_id), roleCheck.ts, structuredLog.ts, cache.ts, featureFlags.ts
- **Agent system**: 9 agent prompt files (accounting, empire, growth, marketing, operations, purchasing, sales, specialists, support) + agentTools.ts + agentToolExecutor.ts
- **Integrations**: QuickBooks (qbClient.ts, qbHttp.ts), WordPress (wpClient.ts), Odoo, RingCentral, Gmail, Meta/Facebook, LinkedIn, TikTok, Stripe, ElevenLabs, Pexels, SEMrush, Wincher, Google Vision, Google Video Intelligence

### Frontend Architecture
- React 18 + Vite 5 + TypeScript 5 + Tailwind CSS v3
- React Query (TanStack) for server state
- React Router v6 for routing
- next-themes for dark mode
- Contexts: AuthProvider, WorkspaceProvider, ChatPanelProvider, DockChatProvider
- Layout: TopBar + AppSidebar (collapsible) + IntelligencePanel (right) + MobileNavV2 (bottom)
- Error boundaries: SmartErrorBoundary (app/page levels with auto-retry)
- Route guards: ProtectedRoute, AdminRoute (allowedEmails), RoleGuard

## Output: `/mnt/documents/system-rebuild-blueprint.md`

A single Markdown file with all 30 sections, each item tagged with confidence level (Confirmed/Inferred/Assumed). Estimated ~200-300KB of structured content covering every route, component, hook, edge function, integration, role, workflow, and deployment detail.

## Technical Approach
- Python script generating the Markdown from all discovered data
- Every section populated from actual codebase evidence
- All 193 edge functions listed with auth mode and purpose
- All 83 routes with permission requirements
- All 21 agents with capabilities
- Full role/permission matrix
- Complete component inventory by module

## Impact
- 0 codebase files changed
- 1 comprehensive Markdown artifact generated

