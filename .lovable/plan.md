

## Backward-Compatible Hardening Patch Wave — Preflight Report & Plan

---

### PHASE 1 — VERIFICATION RESULTS

#### A. Frontend Email ACL Duplication (CONFIRMED)

| File | Inline Emails | What |
|---|---|---|
| `src/hooks/useSuperAdmin.ts` L3 | `["sattar@rebar.shop", "radin@rebar.shop"]` | Super admin check |
| `src/components/auth/RoleGuard.tsx` L108 | `"zahra@rebar.shop"` | Block from /customers |
| `src/components/auth/RoleGuard.tsx` L113 | `["sattar@rebar.shop", "neel@rebar.shop", "vicky@rebar.shop"]` | Accounting access |
| `src/components/auth/RoleGuard.tsx` L122 | `["ai@rebar.shop"]` | Shopfloor device lock |
| `src/pages/AccountingWorkspace.tsx` L180 | `["sattar@rebar.shop", "neel@rebar.shop", "vicky@rebar.shop"]` | Accounting access |
| `src/components/layout/AppSidebar.tsx` L161 | `["sattar@rebar.shop", "radin@rebar.shop"]` | CEO Portal nav |
| `src/components/layout/AppSidebar.tsx` L165 | `["zahra@rebar.shop"]` | Blocked from Customers |
| `src/components/layout/AppSidebar.tsx` L166 | `["sattar@rebar.shop", "neel@rebar.shop", "vicky@rebar.shop"]` | Accounting nav |
| `src/components/layout/MobileNavV2.tsx` L21 | `["zahra@rebar.shop"]` | Blocked from Customers |
| `src/components/layout/MobileNavV2.tsx` L23 | `["sattar@rebar.shop", "neel@rebar.shop", "vicky@rebar.shop"]` | Accounting nav |
| `src/components/layout/MobileNavV2.tsx` L24 | `["sattar@rebar.shop", "radin@rebar.shop"]` | CEO Portal nav |
| `src/components/office/DiagnosticLogView.tsx` L36 | `["sattar@rebar.shop"]` | Super admin (MISSING radin) |

#### B. Backend Super Admin Email Duplication (CONFIRMED)

| Function | Emails | Inconsistency |
|---|---|---|
| `diagnostic-logs` | `["sattar@rebar.shop"]` | Missing radin |
| `ringcentral-active-calls` | `["sattar@rebar.shop"]` | Missing radin |
| `ringcentral-action` | `["sattar@rebar.shop"]` | Missing radin |
| `ringcentral-fax-send` | `["sattar@rebar.shop"]` | Missing radin |
| `ringcentral-sip-provision` | `["sattar@rebar.shop", "radin@rebar.shop"]` | Correct |
| `system-backup` | `["sattar@rebar.shop", "radin@rebar.shop", "ai@rebar.shop"]` | Includes device account |

#### C. System-Backup Role Lookup Bug (CONFIRMED)

Line 90: `.eq("user_id", profileRow.id)` queries `user_roles` with profile UUID.
But `user_roles.user_id` maps to `auth.users.id` (confirmed by `has_role()` DB function and `useUserRole` hook both using `auth.uid()`/`user.id`).
The comment on L78 saying "user_roles is linked by profile.id" is **wrong**.

Fix: use `userId` (auth user ID) instead of `profileRow.id`.

#### D. Shared Helpers (CONFIRMED)

- `_shared/auth.ts` — `requireAuth()`, `optionalAuth()`, `json()`, `corsHeaders` — used by ~40 functions
- `_shared/roleCheck.ts` — `hasRole()`, `hasAnyRole()`, `requireRole()`, `requireAnyRole()` — exists but no `requireSuperAdmin`
- `_shared/requestHandler.ts` — `handleRequest()` wrapper — exists but **0 production consumers**
- `_shared/resolveCompany.ts` — `resolveCompanyId()` — exists, cached

#### E. handleRequest Migration — 3 Named Candidates

| # | Function | Type | Why safe |
|---|---|---|---|
| 1 | `camera-ping` | Low-risk utility | Simple auth + JSON response, no writes to core tables, no company scope needed |
| 2 | `diagnostic-logs` | Admin-only | Super admin gated read-only, also benefits from `requireSuperAdmin` integration |
| 3 | `build-learning-pairs` | Authenticated business | Uses `requireAuth` + company resolution + read/write to `estimation_learnings` only |

All three: no webhooks, no sync engines, no order/delivery/accounting mutations.

#### F. Tenant Isolation Mini-Wave

The service-layer wrappers (`orderService.ts`, `productionService.ts`, `deliveryService.ts`) were already updated with `companyId` parameters in the previous wave. These are **not yet consumed** by any component. No additional tenant-scoping changes needed in this wave — the wrappers are ready.

---

### PHASE 2 — PREPATCH REPORT

#### Files to Create

| File | Category | Reason |
|---|---|---|
| `src/lib/accessPolicies.ts` | Safe additive | Single source for all frontend email ACL constants |
| `supabase/functions/_shared/accessPolicies.ts` | Safe additive | Single source for backend email allowlists |

#### Files to Edit

| File | Category | Change |
|---|---|---|
| `src/hooks/useSuperAdmin.ts` | Safe import replacement | Import from `accessPolicies.ts` |
| `src/components/auth/RoleGuard.tsx` | Safe import replacement | Import constants from `accessPolicies.ts` |
| `src/pages/AccountingWorkspace.tsx` | Safe import replacement | Import `accountingAccess` |
| `src/components/layout/AppSidebar.tsx` | Safe import replacement | Import email lists |
| `src/components/layout/MobileNavV2.tsx` | Safe import replacement | Import email lists |
| `src/components/office/DiagnosticLogView.tsx` | Safe import replacement | Import `superAdmins` (also fixes missing radin) |
| `supabase/functions/_shared/roleCheck.ts` | Safe additive | Add `requireSuperAdmin()` |
| `supabase/functions/system-backup/index.ts` | Safe scoped bug fix | Fix `profileRow.id` → `userId` for user_roles lookup; import shared ACLs |
| `supabase/functions/diagnostic-logs/index.ts` | Safe import replacement + handleRequest migration | Replace inline auth with `handleRequest` wrapper |
| `supabase/functions/ringcentral-active-calls/index.ts` | Safe import replacement | Import shared `SUPER_ADMIN_EMAILS` |
| `supabase/functions/ringcentral-action/index.ts` | Safe import replacement | Import shared `SUPER_ADMIN_EMAILS` |
| `supabase/functions/ringcentral-fax-send/index.ts` | Safe import replacement | Import shared `SUPER_ADMIN_EMAILS` |
| `supabase/functions/ringcentral-sip-provision/index.ts` | Safe import replacement | Import shared `SUPER_ADMIN_EMAILS` |
| `supabase/functions/camera-ping/index.ts` | handleRequest migration | Replace manual auth with `handleRequest` |
| `supabase/functions/build-learning-pairs/index.ts` | handleRequest migration | Replace manual auth+company with `handleRequest` |

#### Intentional Access Normalization (NOT zero behavior change)

These functions currently only allow `sattar@rebar.shop` and will now also allow `radin@rebar.shop`:
- `diagnostic-logs`
- `ringcentral-active-calls`
- `ringcentral-action`
- `ringcentral-fax-send`
- `DiagnosticLogView.tsx` (frontend)

This is intentional — radin is already a declared super admin everywhere else.

#### Confirmed Bug Fix

`system-backup/index.ts` L90: `.eq("user_id", profileRow.id)` → `.eq("user_id", userId)`. The inline comment claiming "user_roles is linked by profile.id" is factually wrong and will be corrected.

#### Items NOT Touched
- Route map, App.tsx route structure
- Database schema
- Auth session flow (lib/auth.ts)
- AdminRoute component (receives emails via props, not inline)
- Core write paths
- Any other edge functions beyond the 9 listed

---

### PHASE 3 — IMPLEMENTATION

#### Patch 1: `src/lib/accessPolicies.ts` (NEW)

```typescript
/** Client-side UX gates only — NOT security boundaries. 
 *  Server-side RLS + edge function checks are authoritative. */
export const ACCESS_POLICIES = {
  superAdmins: ["sattar@rebar.shop", "radin@rebar.shop"],
  accountingAccess: ["sattar@rebar.shop", "neel@rebar.shop", "vicky@rebar.shop"],
  blockedFromCustomers: ["zahra@rebar.shop"],
  shopfloorDevices: ["ai@rebar.shop"],
  ceoPortalAccess: ["sattar@rebar.shop", "radin@rebar.shop"],
  internalDomain: "@rebar.shop",
} as const;
```

#### Patch 2: `supabase/functions/_shared/accessPolicies.ts` (NEW)

```typescript
export const SUPER_ADMIN_EMAILS = ["sattar@rebar.shop", "radin@rebar.shop"];
export const SYSTEM_DEVICE_EMAILS = ["ai@rebar.shop"];
```

#### Patch 3: Frontend import swaps (6 files)

Each file replaces inline email arrays with imports from `accessPolicies.ts`. Zero logic change.

#### Patch 4: `_shared/roleCheck.ts` — add `requireSuperAdmin`

Role-first check via `hasRole(…, "admin")`, email-fallback via `SUPER_ADMIN_EMAILS`. Additive — no existing function signatures change.

#### Patch 5: `system-backup/index.ts` — bug fix

- L90: `.eq("user_id", profileRow.id)` → `.eq("user_id", userId)`
- L78 comment corrected
- Import shared `SUPER_ADMIN_EMAILS` + `SYSTEM_DEVICE_EMAILS`

#### Patch 6: Backend import swaps (4 ringcentral functions)

Replace inline `SUPER_ADMIN_EMAILS` with import from `_shared/accessPolicies.ts`.

#### Patch 7: handleRequest migration (3 functions)

- `camera-ping` — simplest, no company needed, `requireCompany: false`
- `diagnostic-logs` — admin-only, uses `requireSuperAdmin` option pattern
- `build-learning-pairs` — auth + company resolution via wrapper

All preserve exact response shapes and behavior.

