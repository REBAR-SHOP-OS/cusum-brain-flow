

# REBAR SHOP OS — Architectural Remediation Assessment & Plan

---

## PART 1: Current Architecture Risk Assessment

### 1.1 System Scale Summary

| Layer | Count | Notes |
|---|---|---|
| Edge Functions | ~170 | Only **11** use `handleRequest` wrapper; ~159 use ad-hoc boilerplate |
| Frontend Pages | ~81 | Lazy-loaded via React.lazy |
| Hooks | ~140 | Many contain direct Supabase queries |
| Database Tables | ~160+ | With RLS policies |
| Shared Modules | ~35 files in `_shared/` | Good foundation, low adoption |
| Test Files | ~8 | Minimal coverage |
| Service Layer | 6 services + types | Only covers orders, delivery, production, quotes, auth, roles |

### 1.2 Root Causes Identified

**RC-1: Massive boilerplate duplication across Edge Functions (CRITICAL)**
- 159 out of 170 functions duplicate CORS headers, auth verification, company resolution, and error handling inline
- At least 3 different CORS header variants exist (some missing `x-supabase-client-*` headers)
- Each function re-creates Supabase clients independently
- The `handleRequest` wrapper exists and works well, but adoption is only ~6%

**RC-2: Wildcard CORS on all endpoints (SECURITY)**
- Every function uses `Access-Control-Allow-Origin: "*"` — no origin restriction
- Webhook endpoints (qb-webhook, gmail-webhook, ringcentral-webhook) also use wildcard CORS unnecessarily

**RC-3: Inconsistent CORS header sets (STABILITY)**
- Some functions have short CORS headers: `"authorization, x-client-info, apikey, content-type"`
- Others have the full set with `x-supabase-client-*` headers
- Mismatches cause silent failures on certain client configurations

**RC-4: Near-zero test coverage (RISK)**
- Only 8 test files exist for a system with 140+ hooks and 170+ edge functions
- No integration tests for critical flows (auth, QB sync, Gmail sync, order lifecycle)
- No RLS policy tests

**RC-5: Monolithic edge functions (MAINTAINABILITY)**
- `qb-sync-engine`: 1,399 lines in a single file
- `gmail-sync`: 747 lines
- Business logic, HTTP handling, and data access are interleaved

**RC-6: No CI/CD gates (OPERATIONAL RISK)**
- No automated linting or type-checking before deployment
- Edge functions deploy without validation
- Template literal syntax errors (like the one just fixed) reach production

**RC-7: Observability is flag-gated and mostly off**
- `ENABLE_AI_OBSERVABILITY`, `ENABLE_COST_TRACKING`, `ENABLE_BUDGET_GUARDRAILS` default to OFF
- No general-purpose API error rate monitoring
- Structured logging exists (`structuredLog.ts`) but adoption is low outside `handleRequest` users

**RC-8: Super admin list duplicated across frontend and backend**
- `src/lib/accessPolicies.ts` and `supabase/functions/_shared/accessPolicies.ts` maintain separate lists
- Risk of desync on privilege changes

---

## PART 2: Safe Remediation Plan

### Phase 0 — Discovery & Protection (No behavior changes)

| Task | Description | Risk | Rollback |
|---|---|---|---|
| **0.1** Audit CORS variants | Generate inventory of all CORS header variants across 170 functions | None (read-only) | N/A |
| **0.2** Classify edge functions by domain | Tag each function: AI, CRM, Manufacturing, Comms, Auth, Integration, System | None | N/A |
| **0.3** Identify dead/unused functions | Cross-reference function names with frontend invocations | None | N/A |
| **0.4** Baseline smoke test expansion | Add checks for integration tables (gmail, qb, ringcentral connections) to existing `smoke-tests` | Additive only | Remove new checks |

### Phase 1 — Non-Breaking Hardening

| Task | Priority | Files Affected | Behavior Change | Rollback |
|---|---|---|---|---|
| **1.1** Standardize CORS headers in `auth.ts` | HIGH | `_shared/auth.ts` (already done) | None — functions importing `corsHeaders` already get the standard set | N/A |
| **1.2** Migrate functions to `handleRequest` wrapper (batch 1: 20 simplest functions) | HIGH | 20 function `index.ts` files | None — same auth, same response shape | Revert individual file |
| **1.3** Migrate functions batch 2 (20 more) | HIGH | 20 function `index.ts` files | None | Revert individual file |
| **1.4** Migrate functions batch 3 (20 more) | MEDIUM | 20 function `index.ts` files | None | Revert individual file |
| **1.5** Add input validation (zod) to top-10 write endpoints | HIGH | 10 function files | Rejects malformed input that previously would cause DB errors | Keep permissive fallback |
| **1.6** Add unit tests for shared modules | MEDIUM | New test files | None | Delete tests |
| **1.7** Enable structured logging in `handleRequest` (already built-in) | LOW | Adoption via migration | None | N/A |

### Phase 2 — Internal Architectural Cleanup

| Task | Priority | Files Affected | Behavior Change | Rollback |
|---|---|---|---|---|
| **2.1** Extract QB sync logic into domain modules | HIGH | `qb-sync-engine/index.ts` → split into `_shared/qb/` modules | None — same entrypoint, internal refactor | Revert split |
| **2.2** Extract Gmail sync logic into domain modules | HIGH | `gmail-sync/index.ts` → split into `_shared/gmail/` modules | None | Revert split |
| **2.3** Unify AI agent prompt management | MEDIUM | `_shared/agents/*.ts` | None | Revert |
| **2.4** Consolidate duplicate CORS definitions (replace inline with import) | HIGH | ~100 files that define local `corsHeaders` | None | Revert individual file |
| **2.5** Expand service layer for frontend | MEDIUM | New files in `src/lib/serviceLayer/` | None — additive wrappers | Delete new files |
| **2.6** Add integration tests for critical flows | MEDIUM | New test files | None | Delete tests |

### Phase 3 — Controlled Infrastructure Improvements

| Task | Priority | Files Affected | Behavior Change | Rollback |
|---|---|---|---|---|
| **3.1** CORS origin allowlist (phased) | HIGH | `_shared/auth.ts` + env var `ALLOWED_ORIGINS` | Restricts cross-origin access — requires compatibility period | Set `ALLOWED_ORIGINS=*` to revert |
| **3.2** Enable observability flags by default | MEDIUM | Environment variables | More logging, no behavior change | Disable flags |
| **3.3** Add health dashboard endpoint | LOW | New edge function | Additive | Delete function |
| **3.4** Camera service interface formalization | LOW | Documentation + type definitions | None | N/A |
| **3.5** Edge function deployment validation script | MEDIUM | New CI script | Blocks bad deploys | Remove gate |

---

## PART 3: Risk/Impact Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `handleRequest` migration breaks a function | Low | Medium | Migrate one at a time, test each |
| CORS tightening blocks legitimate clients | Medium | High | Phase 3 only, with env-var escape hatch |
| Monolith split introduces import errors | Low | Medium | Keep original entrypoint, extract only internals |
| Test additions slow CI | Very Low | Low | Run in parallel |
| Observability logging increases DB writes | Low | Low | Fire-and-forget, rate-limited |

---

## PART 4: Recommended Execution Order

**Immediate (can start now, zero risk):**
1. Phase 1.2 — Migrate first batch of 20 simple functions to `handleRequest`
2. Phase 2.4 — Replace inline CORS with `import { corsHeaders }` across all functions
3. Phase 1.6 — Add tests for `auth.ts`, `resolveCompany.ts`, `roleCheck.ts`, `cache.ts`

**Next sprint:**
4. Phase 1.3 & 1.4 — Continue `handleRequest` migration
5. Phase 1.5 — Input validation on write endpoints
6. Phase 2.1 & 2.2 — Split QB and Gmail monoliths

**Following sprint:**
7. Phase 3.1 — CORS origin restriction with env-var allowlist
8. Phase 3.2 — Enable observability
9. Phase 2.6 — Integration tests

---

## PART 5: What Remains Unchanged

- All frontend pages, routing, and UI behavior
- All database schemas, RLS policies, and triggers
- All authentication flows (JWT, session management)
- All external integration contracts (QB, Odoo, Gmail, RingCentral)
- All AI agent prompts and behavior
- All API response shapes and status codes
- Production deployment process

---

## PART 6: Deliverable Summary

This plan produces:
1. **Architecture remediation report** — this document
2. **Non-breaking implementation plan** — Phase 1-3 tables above with rollback for each
3. **Testing plan** — Unit tests for shared modules, integration tests for critical flows
4. **Security hardening plan** — CORS restriction, input validation, secret audit
5. **Observability plan** — Structured logging adoption, health checks, flag enablement
6. **Migration safety plan** — Batch migrations, env-var escape hatches, no destructive first steps

Shall I proceed with implementation starting from Phase 1.2 (migrating the first batch of edge functions to `handleRequest`)?

