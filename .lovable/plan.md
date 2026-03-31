

# FINAL-SYSTEM-REBUILD-SPEC.md Generation Plan

## Scope Assessment

This system (REBAR SHOP OS) is massive:
- **193+ edge functions** across 10 domains
- **150+ database tables** (16,744 lines of type definitions)
- **80+ pages/routes** with role-based access
- **50+ component directories**
- **15+ external integrations** (QuickBooks, RingCentral, Gmail, LinkedIn, Facebook, TikTok, ElevenLabs, Stripe, Odoo, Semrush, WordPress, WooCommerce, Google Vision, Pexels, Firecrawl)
- **8 user roles** with complex routing logic
- **40+ shared utility modules** in `_shared/`

A complete spec covering all 35 sections with full JSON Schema contracts for every edge function would produce a document exceeding **200,000 lines** — far beyond what can be generated in one pass.

## Realistic Approach

I will generate the document as a downloadable `.md` artifact in `/mnt/documents/`, structured in **phases**:

### Phase 1 — Core Architecture (this pass)
Sections 1-13: System identification, executive summary, feature inventory, route map, user journeys, role matrix, frontend/backend architecture, data model, API blueprint, auth/authz. These are fully extractable from the codebase.

### Phase 2 — Business Logic & Operations
Sections 14-23: Business rules, forms, automations, notifications, search, file handling, error handling, security, performance.

### Phase 3 — Edge Function Contracts (the bulk)
Sections 32, 35: Full request/response/error schemas for all 193+ functions. This requires reading each function's `index.ts` individually.

### Phase 4 — Final Assembly
Sections 24-31, 33-34: Environment variables, testing, file structure, rebuild plan, realtime contracts, external integrations, validation matrix, AI prompt pack.

## What I Need to Read First

To produce Phase 1, I need to read:
- Full database schema (types.ts — all 16,744 lines, extracting table names and columns)
- Key shared modules (`auth.ts`, `resolveCompany.ts`, `roleCheck.ts`, `requestHandler.ts`)
- Representative edge functions from each domain (at least 1 per domain)
- Auth flow (`src/lib/auth.tsx`)
- Service layer patterns

## Deliverable

A single `FINAL-SYSTEM-REBUILD-SPEC.md` file written to `/mnt/documents/`, starting with Phase 1 (Sections 1-13) which is the architectural foundation. Subsequent phases can be appended in follow-up passes.

## Confidence

| Section | Confidence | Source |
|---------|-----------|--------|
| System ID, Summary | High | Codebase + memory |
| Route Map | High | App.tsx fully visible |
| Role Matrix | High | useUserRole + RoleGuard + accessPolicies |
| Database Schema | High | types.ts (16,744 lines) |
| Edge Function Inventory | High | edgeFunctionInventory.ts + directory listing |
| Full API Contracts | Medium | Requires reading each function individually |
| Business Rules | Medium | Scattered across components and functions |
| External Integration Details | Low-Medium | Requires reading OAuth flows and webhook handlers |

---

**Shall I proceed with Phase 1 generation (Sections 1-13), or do you want all 35 sections attempted in one pass?** If all 35, the edge function contracts section will use the inventory metadata rather than full schema extraction for functions not yet read.

