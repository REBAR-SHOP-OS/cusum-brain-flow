# Rebar Shop OS — System Architecture (March 2026)

## 1. Overview

**Rebar Shop OS** is a multi-tenant ERP + AI platform for rebar fabrication shops.

| Layer | Technology |
|---|---|
| Frontend | React 18 · Vite · Tailwind CSS · TypeScript |
| Backend | Lovable Cloud (Supabase) — 160+ tables, 193 edge functions |
| AI | 21+ agent ecosystem via Lovable AI proxy (Gemini, GPT-5) |
| Auth | Supabase Auth + RBAC (user_roles table, 8 roles) |
| State | React Query (server) · React Context (workspace, chat, dock) |

---

## 2. Frontend Architecture

### Pages & Routing
- **81+ pages**, lazy-loaded where heavy (Brain, QaWar, SynologyNAS, Sales)
- Route layout: `Landing (public)` → `Login/Signup` → `ProtectedRoute + AppLayout`
- Role gating via `AdminRoute` (super admin) and `useUserRole` hook

### Component Organization
- **55+ component directories** mapped to business domains
- Shared UI via shadcn/ui components with custom variants
- Error handling: `SmartErrorBoundary` (app/page level) + `GlobalErrorHandler`

### State Management
- **React Query** — all server state (queries, mutations, cache)
- **React Context** — workspace selection, chat state, dock panels
- **useRef guards** — prevent duplicate refresh loops

### Performance
- Lazy loading via `React.lazy` for heavy pages
- Vite deduplication for shared dependencies
- Mandatory `.limit()` on list-based queries to prevent large reads

---

## 3. Module Map (by domain)

### Sales & CRM
Pipeline · Lead Scoring · Prospecting · Customers · Sales Hub · Bid Board · Contacts

### Operations
ShopFloor · Cutter · Stations · Loading · Pickup · Clearance · Pool · Machines · Inventory

### Delivery
DeliveryOps · DeliveryTerminal · Smart Dispatch · Driver Assignment

### Accounting
AccountingWorkspace · AccountingHealth · QuickBooks Sync · Budgets · CCA Schedule · Bank Feed

### AI Agents
AgentWorkspace · Brain · Vizzy · Nila · AzinInterpreter · Pipeline AI · SEO Copilot

### Communications
Phonecalls (RingCentral) · Gmail · TeamHub · LiveChat · Chat Threads

### Marketing
SocialMediaManager · VideoStudio · AdDirector · EmailMarketing · SEO · Brand Kit

### Website
WebsiteManager · EmpireBuilder · AppBuilder · WordPress Integration

### HR / Admin
TimeClock · OrgChart · Settings · AdminPanel · SystemBackup · FeatureFlagAdmin

### Customer-facing
CustomerPortal · VendorPortal · KnowledgeBase · SupportInbox

---

## 4. Database Layer

| Metric | Value |
|---|---|
| Tables | ~160+ |
| Views | ~20 |
| RPC Functions | ~30 |
| Enums | 1 (`app_role`) |

### Multi-tenancy
- All business tables scoped by `company_id`
- RLS enforced on all tables
- `user_roles` table for RBAC (8 roles)

### Key Tables by Domain

| Domain | Core Tables |
|---|---|
| Users | `profiles`, `user_roles`, `companies` |
| Sales | `leads`, `customers`, `contacts`, `quotes`, `bid_board` |
| Operations | `work_orders`, `barlists`, `barlist_items`, `cut_batches`, `bend_batches`, `bundles` |
| Delivery | `deliveries`, `delivery_items`, `trucks` |
| Accounting | `accounting_mirror`, `budgets`, `bank_feed_balances` |
| AI | `chat_sessions`, `chat_messages`, `ai_usage_log`, `ai_execution_log`, `agents` |
| Automation | `automation_configs`, `automation_runs`, `autopilot_runs`, `autopilot_actions` |
| Alerts | `notifications`, `alert_routing_rules`, `alert_dispatch_log`, `alert_escalation_queue` |
| Activity | `activity_events` (append-only ledger with `dedupe_key`) |

---

## 5. Edge Functions (Backend)

| Metric | Value |
|---|---|
| Total functions | 193 |
| Migrated to `handleRequest` | 192 (99.5%) |
| Excluded | 1 (`mcp-server` — Hono framework) |

### `handleRequest` Wrapper Features
- **`authMode`**: `"required"` (default) · `"optional"` · `"none"`
- **`parseBody`**: `true` (default) · `false` (FormData/multipart)
- **`wrapResult`**: `true` (default, `{ ok, data }`) · `false` (pass-through)
- **`rawResponse`**: handler returns `Response` directly
- **`requireCompany`**: company resolution from profiles
- **`requireRole` / `requireAnyRole`**: role-based access control

### Auth Mode Distribution

| authMode | Count |
|---|---|
| `"required"` (default) | ~124 |
| `"none"` | 50 |
| `"optional"` | 17 |

### Special Patterns
- `parseBody: false` — 10 functions (FormData endpoints)
- `wrapResult: false` — 165 functions (legacy response shape preservation)
- `rawResponse: true` — 18 functions (streaming/custom responses)

---

## 6. Shared Backend Utilities (`_shared/`)

| File | Purpose |
|---|---|
| `requestHandler.ts` | Unified edge function wrapper |
| `auth.ts` | `requireAuth()`, `optionalAuth()`, `optionalAuthFull()` |
| `resolveCompany.ts` | Cached `company_id` resolution from profiles |
| `roleCheck.ts` | `requireRole()`, `requireAnyRole()`, `requireSuperAdmin()` |
| `structuredLog.ts` | JSON structured logging |
| `cache.ts` | In-memory TTL cache |
| `accessPolicies.ts` | Super admin email allowlist |
| `featureFlags.ts` | Boolean env flag parsing + Odoo guard |
| `aiRouter.ts` | AI model routing (multi-provider) |
| `agentPrompts.ts` | Agent system prompt registry |
| `agentTypes.ts` | Shared agent type definitions |

### Agent Sub-modules (`_shared/agents/`)
- `sales.ts`, `accounting.ts`, `operations.ts`, `support.ts`
- `marketing.ts`, `growth.ts`, `specialists.ts`, `empire.ts`, `purchasing.ts`

### Domain Clients
- `qbClient` — QuickBooks API wrapper
- `wpClient` — WordPress API wrapper
- `quoteCalcEngine` — Quote pricing engine
- `rebarCalcEngine` — Rebar weight/length calculations

---

## 7. Service Layer (Frontend)

Located in `src/lib/serviceLayer/`:

| Service | Domain |
|---|---|
| `orderService` | Work order CRUD |
| `productionService` | Shop floor production |
| `deliveryService` | Delivery management |
| `quoteService` | Quote generation |
| `roleService` | Role-based access |
| `authService` | Authentication helpers |

All services return `ServiceResult<T>` (`{ ok, data, error? }`).

---

## 8. External Integrations

| Integration | Capabilities |
|---|---|
| **QuickBooks Online** | OAuth + sync engine + webhooks (customers, invoices, payments) |
| **RingCentral** | OAuth + calls + fax + video + webhooks |
| **Google** | Gmail (OAuth), Vision OCR, Calendar |
| **Facebook / TikTok / LinkedIn** | OAuth + social publishing |
| **ElevenLabs** | TTS, transcription, music generation |
| **Stripe** | Payments + QuickBooks webhook bridge |
| **Semrush / Wincher** | SEO keyword tracking |
| **Synology NAS** | File proxy for shop floor documents |
| **WordPress** | Site management + content publishing |
| **Pexels** | Stock media for marketing |
| **Odoo** | ERP sync (feature-flagged) |

---

## 9. AI Agent Ecosystem

### 21+ Agents

| Agent | Role |
|---|---|
| **Vizzy** | Executive AI assistant (CEO portal) |
| **Nila** | Voice AI (ElevenLabs TTS) |
| **Pipeline AI** | Sales pipeline automation |
| **SEO Copilot** | SEO analysis + recommendations |
| **Ad Director** | Ad campaign creation |
| **Support Chat** | Customer support automation |
| **Website Agent** | Website content generation |
| **Empire Architect** | Multi-site builder |
| **Commander** | System orchestration |
| **Data Agent** | Analytics + reporting |
| *+ 11 more* | Sales, accounting, legal, talent, etc. |

### Architecture
- **Routing**: `aiRouter.ts` — multi-provider (Gemini 2.5, GPT-5)
- **Context**: `vizzyFullContext`, `agentSharedInstructions`
- **Tools**: `agentToolExecutor` with structured tool definitions
- **QA**: `agentQA` for response validation
- **Logging**: `ai_usage_log` + `ai_execution_log` tables

---

## 10. Security Model

### Authentication
- Supabase Auth (email/password)
- JWT verification inside edge functions via `requireAuth()`
- Gateway `verify_jwt = false` — auth handled in application code

### Authorization
- **RBAC**: `user_roles` table with 8 roles:
  `admin` · `sales` · `accounting` · `office` · `workshop` · `field` · `shop_supervisor` · `customer`
- **Super Admin**: role-first (`admin` role) + email fallback (3 emails in `accessPolicies.ts`)
- **RLS**: enforced on all tables with `company_id` scoping

### Frontend Guards
- `ProtectedRoute` — requires authentication
- `AdminRoute` — requires super admin (email-based, migrating to roles)
- `useUserRole` hook — role checks for UI gating
- `useSuperAdmin` hook — super admin check

### CORS
- All edge function responses include CORS headers via `corsHeaders` constant

---

## 11. Observability

| System | Purpose |
|---|---|
| Structured JSON logging | All edge functions via `createLogger()` |
| `ai_usage_log` | Token usage per AI call |
| `ai_execution_log` | Full execution trace (latency, cost, errors) |
| `activity_events` | Business event ledger (append-only, dedupe) |
| `automation_runs` | Automation execution history |
| `smoke-tests` endpoint | Health check for all services |
| Feature flags | `featureFlags.ts` + `FeatureFlagAdmin` UI |
| QA War Engine | Bug tracking + regression testing |

---

## 12. Technical Debt & Known Issues

| Issue | Severity | Notes |
|---|---|---|
| `website-agent` CORS boilerplate | Low | Leftover CORS inside handler (cosmetic) |
| `extract-manifest` std version | Low | Uses `std@0.224.0` via import_map remap |
| 165 functions use `wrapResult: false` | Medium | Legacy response shapes; can standardize |
| Email-based `AdminRoute` gating | Medium | Should migrate to role-based checks |
| No integration tests for auth modes | Medium | `handleRequest` auth paths untested |

---

## 13. Conventions

### Deno Standard Library
All edge functions use `https://deno.land/std@0.190.0/`. See `_shared/DENO_STD_VERSION.md`.

### Edge Function Structure
Single `index.ts` per function, using `handleRequest` wrapper:
```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

serve((req) => handleRequest(req, async (ctx) => {
  // Business logic here
  return { result: "data" };
}, { functionName: "my-function" }));
```

### Activity Events
All operational events recorded in `activity_events` with:
- `dedupe_key` for idempotency
- `entity_type` + `entity_id` for linking
- `source` field for origin tracking

### Query Safety
- Mandatory `.limit()` on list queries
- `company_id` scoping on all business queries
- `useRef` guards to prevent duplicate refresh loops
