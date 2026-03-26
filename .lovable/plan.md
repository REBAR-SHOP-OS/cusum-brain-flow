

# Updated Architecture Document

## What
Replace the current `.lovable/plan.md` (which only covers the handleRequest migration) with a comprehensive architecture document covering the full Rebar Shop OS system as it stands today.

## Document Structure

The new `REBAR_SHOP_OS_Architecture.md` will be created in the `docs/` directory (alongside the existing `KNOWLEDGE_BOOK.md`). The old `.lovable/plan.md` migration tracker will be updated to link to the new doc.

### Outline

```text
# Rebar Shop OS — System Architecture (March 2025)

## 1. Overview
   - Multi-tenant rebar fabrication ERP + AI platform
   - Tech stack: React 18 + Vite + Tailwind + TypeScript (frontend)
   - Backend: Lovable Cloud (Supabase) — 160+ tables, 193 edge functions
   - AI: 21+ agent ecosystem via Lovable AI proxy (Gemini, GPT-5)

## 2. Frontend Architecture
   - 81+ pages, lazy-loaded where heavy (Brain, QaWar, SynologyNAS, Sales)
   - Route layout: Landing (public) → Login/Signup → ProtectedRoute + AppLayout
   - Component domains: 55+ component directories mapped to modules
   - State: React Query (server), React Context (workspace, chat, dock)
   - Error handling: SmartErrorBoundary (app/page level) + GlobalErrorHandler
   - Auth: AuthProvider wrapping all routes, AdminRoute for role gating

## 3. Module Map (by domain)
   - Sales & CRM: Pipeline, Lead Scoring, Prospecting, Customers, Sales Hub
   - Operations: ShopFloor, Cutter, Stations, Loading, Pickup, Clearance, Pool
   - Delivery: DeliveryOps, DeliveryTerminal, Smart Dispatch
   - Accounting: AccountingWorkspace, AccountingHealth, QuickBooks sync
   - AI Agents: AgentWorkspace, Brain, Vizzy, Nila, AzinInterpreter
   - Communications: Phonecalls (RingCentral), Gmail, TeamHub, LiveChat
   - Marketing: SocialMediaManager, VideoStudio, AdDirector, EmailMarketing, SEO
   - Website: WebsiteManager, EmpireBuilder, AppBuilder
   - HR/Admin: TimeClock, OrgChart, Settings, AdminPanel, SystemBackup
   - Customer-facing: CustomerPortal, VendorPortal, KnowledgeBase, SupportInbox

## 4. Database Layer
   - ~160+ tables, ~20 views, ~30 RPC functions, 1 enum (app_role)
   - Multi-tenant via company_id on all business tables
   - Key tables by domain (profiles, orders, barlists, customers, etc.)
   - RLS enforced; user_roles table for RBAC (8 roles)

## 5. Edge Functions (Backend)
   - 193 total, 192 using handleRequest wrapper
   - Shared middleware: auth, company resolution, role check, structured logging
   - Auth modes: required (124), none (50), optional (17)
   - Special patterns: parseBody:false (10), wrapResult:false (165), rawResponse (18)
   - Excluded: mcp-server (Hono framework)

## 6. Shared Backend Utilities (_shared/)
   - requestHandler.ts — unified wrapper
   - auth.ts — requireAuth, optionalAuthFull
   - resolveCompany.ts — cached company lookup
   - roleCheck.ts — RBAC enforcement + super admin
   - structuredLog.ts — JSON logging
   - cache.ts — TTL in-memory cache
   - accessPolicies.ts — super admin email list
   - aiRouter.ts — AI model routing
   - Agent system: agentTools, agentPrompts, agentContext, agentQA
   - Domain: qbClient, wpClient, quoteCalcEngine, rebarCalcEngine

## 7. Service Layer (Frontend)
   - src/lib/serviceLayer/ — domain services with ServiceResult<T>
   - orderService, productionService, deliveryService, quoteService, roleService, authService

## 8. External Integrations
   - QuickBooks Online (OAuth + sync engine + webhooks)
   - RingCentral (OAuth + calls + fax + video + webhooks)
   - Google (Gmail, Vision OCR, OAuth)
   - Facebook/TikTok/LinkedIn (OAuth + social publishing)
   - ElevenLabs (TTS, transcription, music)
   - Stripe (payments + QB webhook bridge)
   - Semrush/Wincher (SEO data)
   - Synology NAS (file proxy)
   - WordPress (site management)
   - Pexels (stock media)

## 9. AI Agent Ecosystem
   - 21+ agents: Vizzy (executive), Nila (voice), Pipeline AI, SEO Copilot,
     Ad Director, Support Chat, Website Agent, Empire Architect, etc.
   - Shared context: vizzyFullContext, agentSharedInstructions
   - Tool execution: agentToolExecutor with structured tool definitions
   - AI routing via aiRouter.ts (multi-provider: Gemini, GPT-5)

## 10. Security Model
   - RLS on all tables with company_id scoping
   - user_roles table (8 roles: admin, sales, accounting, office, workshop, field, shop_supervisor, customer)
   - Super admin: role-first + email fallback (3 emails)
   - Edge functions: JWT verification disabled at gateway, handled in-code via requireAuth
   - CORS headers on all responses

## 11. Observability
   - Structured JSON logging (all edge functions)
   - AI usage tracking (ai_usage_log, ai_execution_log)
   - smoke-tests endpoint
   - Feature flags (featureFlags.ts + FeatureFlagAdmin UI)
   - QA War Engine for bug tracking

## 12. Technical Debt & Known Issues
   - website-agent: leftover CORS boilerplate inside handler
   - extract-manifest: uses std@0.224.0 (remapped via import_map)
   - 165 functions use wrapResult:false (legacy response shapes)
   - Some routes use email-based AdminRoute gating (should migrate to roles)
```

### Files Changed

| File | Change |
|---|---|
| `docs/REBAR_SHOP_OS_Architecture.md` | New — full architecture document |
| `.lovable/plan.md` | Update to link to architecture doc, keep migration summary |

### Technical Notes
- All metrics are derived from actual codebase inspection (types.ts = 16,723 lines, 160+ table definitions, 30+ RPC functions)
- Edge function counts verified via directory listing (193 directories)
- Page count from App.tsx route definitions (81+ routes)
- Component directory count from src/components listing (55+ directories)

