

# Plan: Generate Comprehensive REBAR SHOP OS Architecture PDF

## Objective
Create a detailed PDF document covering the entire system architecture, all modules, all edge functions, all AI agents, database structure, security model, and integrations.

## Document Structure

The PDF will be generated using ReportLab (Python) and will contain the following sections:

### 1. Executive Summary
- System name: REBAR SHOP OS
- Tech stack: React 18 + Vite 5 + Tailwind CSS + TypeScript + Supabase (Lovable Cloud)
- 80+ pages, 150+ edge functions, 21 AI agents, 100+ database tables

### 2. Application Architecture
- 3-layer layout: TopBar → Sidebar + Main Content + Intelligence Panel
- Provider hierarchy: ThemeProvider → QueryClient → AuthProvider → WorkspaceProvider → RoleGuard
- Error handling: SmartErrorBoundary at app/page levels
- Lazy loading strategy for heavy pages (Brain, Integrations, QaWar, etc.)

### 3. All Pages & Routes (80+)
Complete listing from App.tsx including:
- **Office**: Home, Inbox, Tasks, Pipeline, Lead Scoring, Customers, Accounting, Sales Hub
- **CEO/Executive**: CEO Portal, Live Monitor, Autopilot Dashboard, Empire Builder
- **Sales Department**: SalesHub, SalesPipeline, SalesQuotations, SalesInvoices, SalesContacts
- **Manufacturing**: ShopFloor, StationView, StationDashboard, CutterPlanning, PoolView, LoadingStation, PickupStation, ClearanceStation, InventoryCount, BendQueue
- **Delivery**: DeliveryOps, DeliveryTerminal, SmartDispatch
- **Communications**: Phonecalls, InboxManager, EmailMarketing, SocialMediaManager, VideoStudio, AdDirector
- **AI/Agents**: AgentWorkspace (21 agents), AzinInterpreter, VizzyLive
- **Website/SEO**: WebsiteManager, SeoModule
- **Admin**: AdminPanel, AdminMachines, AdminDbAudit, ConnectionsAudit, DataStoresAudit, ProductionAudit, WasteBankAdmin, BundleAdmin
- **HR**: TimeClock, TeamHub, OrgChart
- **Public**: Landing, CustomerPortal, VendorPortal, KnowledgeBase, AcceptQuote, Install
- **System**: Settings, Integrations, Brain, Transcribe, QaWar, AutomationsHub, AppBuilder

### 4. AI Agent Orchestra (21 Agents)
Full details from agentRouter.ts:
| Agent ID | Name | Domain | Keywords |
|----------|------|--------|----------|
| sales | Blitz | Revenue | leads, pipeline, deals |
| accounting | Penny | Finance | invoices, QB, payroll |
| support | Haven | Support | tickets, complaints |
| legal | Tally | Legal | contracts, compliance |
| estimating | Gauge | Estimation | quotes, takeoffs |
| shopfloor | Forge | Manufacturing | machines, production |
| delivery | Atlas | Logistics | dispatch, trucks |
| email | Relay | Comms | inbox, gmail |
| social | Pixel | Marketing | posts, social media |
| eisenhower | Eisenhower Matrix | Productivity | priority matrix |
| data | Prism | Analytics | reports, KPIs |
| bizdev | Buddy | BizDev | partnerships, markets |
| webbuilder | Commet | Website | landing pages, SEO |
| assistant | Vizzy | Executive | scheduling, briefs |
| copywriting | Penn | Content | blogs, articles |
| talent | Scouty | HR | hiring, recruitment |
| seo | Seomi | SEO | keywords, rankings |
| growth | Gigi | Personal Dev | coaching, goals |
| empire | Architect | Strategy | ventures, diagnostics |
| commander | Commander | Operations | departments, KPIs |
| purchasing | Kala | Procurement | supplies, orders |

- Routing: Keyword fast-path + LLM fallback (threshold: score < 6)
- Matrix Orchestra hierarchy: 5 departments (REVENUE, OPERATIONS, SUPPORT, GROWTH, SPECIAL OPS)

### 5. Edge Functions Inventory (150+)
Categorized by domain from the functions directory:
- **Auth** (5): google-oauth, facebook-oauth, linkedin-oauth, tiktok-oauth, kiosk-*
- **AI/Agents** (20+): ai-agent, agent-router, ai-estimate, ai-generate-quotation, ai-inline-suggest, ai-media-suggestions, autopilot-engine, pipeline-ai, etc.
- **Manufacturing** (10+): manage-machine, manage-bend, manage-extract, manage-inventory, log-machine-run, shape-vision, extract-manifest, ingest-shop-drawings
- **Accounting** (10+): qb-sync-engine, qb-audit, qb-webhook, quickbooks-oauth, payroll-engine, auto-reconcile, ar-aging-escalation, relink-orphan-invoices
- **Communications** (15+): gmail-sync/send/webhook, ringcentral-*, alert-router, comms-alerts, translate-message, summarize-call
- **Social Media** (8+): social-publish, social-cron-publish, auto-generate-post, schedule-post, regenerate-post, social-intelligence, video-to-social
- **SEO** (12+): seo-ai-*, seo-site-crawl, seo-rank-check, semrush-api, wincher-*
- **Video/Media** (8+): generate-video, generate-image, generate-thumbnail, edit-video-prompt, elevenlabs-*, gce-video-assembly
- **Delivery** (3): smart-dispatch, validate-clearance-photo, camera-events
- **CRM/Pipeline** (6): pipeline-automation-engine, pipeline-webhooks, pipeline-lead-recycler, prospect-leads, relay-pipeline
- **Email Marketing** (5): email-campaign-generate/send, email-automation-check, email-analytics, email-unsubscribe
- **Vizzy** (8+): vizzy-agent-audit, vizzy-briefing, vizzy-business-watchdog, vizzy-call-receptionist, vizzy-context, vizzy-daily-brief, vizzy-erp-action, vizzy-glasses-webhook
- **Website** (6): admin-chat, website-*, wp-fix-hero, wp-speed-optimizer
- **Infrastructure** (10+): smoke-tests, system-backup, daily-summary, diagnostic-logs, camera-ping, send-push, generate-vapid-keys

### 6. Security & Access Control
- **Roles**: admin, sales, accounting, office, workshop, field, shop_supervisor, customer
- **Super Admins**: sattar@rebar.shop, radin@rebar.shop, zahra@rebar.shop
- **RoleGuard**: Multi-tier route protection (internal, external, customer, device accounts)
- **Access Policies**: Email-based UX gates (accountingAccess, blockedFromShopFloor, shopfloorDevices, externalEstimators)
- **RLS**: Row-Level Security on all tables with company_id scoping
- **Edge Function Auth**: handleRequest wrapper with authMode (required/none/optional)
- **Multi-tenancy**: company_id isolation across all queries

### 7. External Integrations
- **QuickBooks**: Bidirectional sync, OAuth, webhooks
- **Odoo**: CRM sync, order lines, chatter, file proxy, reconciliation
- **Google**: OAuth, Gmail API, Google Vision OCR, Search Console
- **RingCentral**: Call sync, webhooks, SIP, video, recording, presence, fax
- **Facebook/Instagram/LinkedIn/TikTok**: OAuth + publishing
- **ElevenLabs**: TTS, music generation, transcription, voice
- **Stripe**: Payment processing, QB webhook sync
- **Pexels**: Stock media search
- **SEMrush/Wincher**: SEO data import
- **Synology NAS**: File storage proxy
- **Reolink**: Camera intelligence (RTSP + YOLOv8)

### 8. Database Architecture
- 100+ tables with RLS policies
- Four-tier hierarchy: Companies → Contacts → Projects → Scopes of Work
- Key tables: profiles, user_roles, companies, customers, orders, barlists, cut_plans, production_tasks, social_posts, sales_leads, activity_events
- Realtime subscriptions for live data
- activity_events ledger with dedupe_key

### 9. Frontend Architecture
- **Components**: 55+ component directories
- **Hooks**: 130+ custom hooks
- **Contexts**: ChatPanel, DockChat, Workspace
- **Service Layer**: Typed ServiceResult<T> wrappers
- **State Management**: React Query (TanStack) with staleTime caching

### 10. Key Subsystems Detail
- **Social Media Manager**: Post lifecycle (draft→scheduled→publishing→published/failed), token resolution (Company-First), No-Fallback publishing rule, per-page status tracking
- **Production Pipeline**: Extract → Cut Plans → Production Tasks → Bundles → Loading → Delivery
- **Quote Engine**: AI estimation → quotation → acceptance → order conversion
- **Payroll Engine**: TimeClock → auto-clockout → payroll calculation
- **Autopilot**: Multi-step autonomous business operations

## Technical Approach
- Python script using ReportLab with Platypus (multi-page)
- Professional formatting with table of contents, headers/footers, page numbers
- Color-coded sections, tables for structured data
- Output: `/mnt/documents/REBAR_SHOP_OS_Architecture.pdf`

## Impact
- 0 code files changed
- 1 PDF artifact generated
- Comprehensive reference document for the entire system

