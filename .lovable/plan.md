

## Zero-Downtime Stabilization Plan — Phase 1 Execution Wave

### Current State Summary

The system already has solid building blocks:
- `_shared/auth.ts` — `requireAuth()` and `optionalAuth()` 
- `_shared/featureFlags.ts` — `isEnabled()` for env-based flags
- `_shared/writeEvent.ts` — standardized activity event logging
- `_shared/cache.ts` — in-memory TTL cache
- `_shared/aiRouter.ts` — centralized AI model routing

**What's missing**: company resolution is copy-pasted across 85+ functions. No structured logging. No database-driven feature flags. Only 1 test file exists. No service layer abstraction.

---

### New Files to Introduce

```text
supabase/functions/_shared/
├── auth.ts                    (exists — keep as-is)
├── featureFlags.ts            (exists — extend)
├── resolveCompany.ts          (NEW — centralize company_id lookup)
├── structuredLog.ts           (NEW — JSON structured logging)
├── requestHandler.ts          (NEW — shared request wrapper)
├── roleCheck.ts               (NEW — server-side role validation)
└── responseHelpers.ts         (NEW — standardized error/success shapes)

supabase/functions/smoke-tests/
└── index.ts                   (NEW — health check endpoint)

src/lib/
├── featureFlagService.ts      (NEW — client-side flag reader)
└── serviceLayer/
    ├── authService.ts         (NEW — thin wrapper)
    └── quoteService.ts        (NEW — thin wrapper)
```

---

### Phase 1A — Shared Edge Function Middleware (4 new files)

**1. `_shared/resolveCompany.ts`** — Eliminates 85+ duplicated company lookups

```typescript
// Single function: resolveCompanyId(serviceClient, userId) → companyId | throws
// Includes cache (5min TTL) to reduce DB hits
// Returns null-safe with clear error message
```

**2. `_shared/structuredLog.ts`** — JSON structured logging

```typescript
// logInfo(functionName, message, metadata)
// logWarn(functionName, message, metadata)  
// logError(functionName, message, error, metadata)
// All output JSON to stdout for edge function log parsing
// Includes: timestamp, function, companyId, userId, requestId, duration
```

**3. `_shared/requestHandler.ts`** — Wrapper that handles boilerplate

```typescript
// handleRequest(req, handler, options) → Response
// Handles: CORS preflight, auth, company resolution, error catching
// Options: { requireAuth, requireCompany, requireRole, functionName }
// Catches thrown Responses (from requireAuth) + unexpected errors
// Returns standardized JSON shape: { ok, data, error }
```

**4. `_shared/roleCheck.ts`** — Server-side role validation

```typescript
// hasRole(serviceClient, userId, role) → boolean
// requireRole(serviceClient, userId, role) → void | throws Response(403)
// Uses same user_roles table as frontend
```

**Adoption strategy**: These are purely additive. No existing function changes. New functions can opt-in by importing the wrapper. Old functions continue working unchanged.

---

### Phase 1B — Database Feature Flags

**Migration**: Create `feature_flags` table

```sql
CREATE TABLE public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  description TEXT,
  allowed_roles TEXT[] DEFAULT '{}',
  allowed_user_ids UUID[] DEFAULT '{}',
  allowed_emails TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: readable by authenticated, writable by admin only
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read flags"
  ON public.feature_flags FOR SELECT TO authenticated USING (true);
```

**Seed flags** (all disabled by default):
- `use_new_request_handler`
- `use_new_quote_engine`
- `use_new_pipeline_ui`
- `use_structured_logging`

**Client-side**: `src/lib/featureFlagService.ts` — fetches flags, caches in memory, provides `useFeatureFlag(key)` hook. Falls back to `false` on any error.

---

### Phase 1C — Smoke Test Endpoint

**`supabase/functions/smoke-tests/index.ts`** — A single edge function that runs health checks:

- Auth: can create a service client
- DB: can query `profiles` table
- Company resolution: can resolve default company
- Quotes: can read from `quotations` table
- Orders: can read from `orders` table
- Returns JSON report with pass/fail per check + latency

Called manually or via cron. No writes, read-only checks.

---

### Phase 1D — First Service Layer Wrappers

**`src/lib/serviceLayer/authService.ts`**
- Wraps `supabase.auth.getUser()`, `signIn`, `signOut`
- Adds structured error handling
- Existing `useAuth` hook calls this instead of raw supabase

**`src/lib/serviceLayer/quoteService.ts`**
- Wraps quote CRUD operations
- Existing quote components call this instead of raw supabase queries
- Same inputs/outputs — zero behavior change

---

### First 10 Safest Changes (in order)

| # | Change | Risk |
|---|--------|------|
| 1 | Add `_shared/structuredLog.ts` | Zero — new file, nothing imports it yet |
| 2 | Add `_shared/resolveCompany.ts` | Zero — new file, nothing imports it yet |
| 3 | Add `_shared/roleCheck.ts` | Zero — new file |
| 4 | Add `_shared/requestHandler.ts` | Zero — new file |
| 5 | Create `feature_flags` table (migration) | Low — new table, no existing code affected |
| 6 | Add `src/lib/featureFlagService.ts` | Zero — new file |
| 7 | Add `supabase/functions/smoke-tests/index.ts` | Zero — new endpoint |
| 8 | Migrate ONE edge function (`build-learning-pairs`) to use `requestHandler` | Low — small, non-critical function |
| 9 | Add `src/lib/serviceLayer/authService.ts` wrapper | Zero — new file |
| 10 | Add `src/lib/serviceLayer/quoteService.ts` wrapper | Zero — new file |

---

### First 5 Things Explicitly Forbidden

| # | Forbidden Action | Reason |
|---|-----------------|--------|
| 1 | Renaming any edge function folder | Breaks all client calls immediately |
| 2 | Changing `_shared/auth.ts` signature | 150+ functions import it |
| 3 | Modifying `RoleGuard.tsx` logic | Live routing for all users |
| 4 | Deleting or renaming any database table/column | Live data dependencies |
| 5 | Force-migrating existing functions to new wrapper | Must be opt-in, one at a time |

---

### Rollback Plan

Every change is a new file or new table. Rollback = delete the file or drop the table. No existing code is modified in Phase 1.

### Test Plan

- Smoke test endpoint validates core DB connectivity
- Each new shared helper gets a unit test in `_shared/__tests__/`
- Feature flag service tested by toggling a flag and verifying client reads
- Service layer wrappers tested by calling through them and comparing output to direct calls

### Risk Assessment

**Phase 1 overall risk: MINIMAL** — All changes are purely additive. No existing behavior is modified. New code is opt-in only. Old functions continue working unchanged.

