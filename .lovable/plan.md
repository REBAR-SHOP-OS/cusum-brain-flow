

## Wave 2 Correction Pass — Harden Existing Scaffolding

### Current Gaps Found

1. **Smoke tests** — Already have shape checks but missing: audit helper execution test, auth response shape validation (user object fields), and `dedupe_key` presence check on activity_events
2. **Audit helper** — Missing: `requestId`/correlation ID, `status` (success/fail), timestamp override. Only has basic fields
3. **Read wrappers** — Work but lack standardized `ServiceResult<T>` return shape and consistent error codes
4. **Rollout registry** — Missing: `status` ("active"/"disabled"), `notes` field
5. **Function inventory** — Missing: `purpose`, `hasAuditLogging`, `migrationPriority` fields

---

### TASK 1 — Harden Smoke Tests

**File: `supabase/functions/smoke-tests/index.ts`** (edit)

Add 2 new checks after existing Wave 2 checks:

| Check | Logic |
|---|---|
| `auth_user_shape` | Verify sampled user object has `id`, `email`, `created_at` fields |
| `audit_write_safe` | Insert a test audit row with `entity_type: "smoke-test-probe"`, then immediately delete it by ID. Confirms audit pipeline works end-to-end. If delete fails, still passes (row is harmless). |

Also tighten existing `quote_response_shape` to check `total_amount` field exists alongside current 4 fields.

---

### TASK 2 — Upgrade Audit Helper

**File: `supabase/functions/_shared/auditLog.ts`** (edit)

Expand `AuditEntry` interface to include:
- `requestId?: string` — correlation ID for tracing
- `status?: "success" | "failure"` — outcome of the audited action
- `timestamp?: string` — optional override (defaults to DB `now()`)

Update `writeAuditLog` to include these in the metadata payload:
```typescript
metadata: {
  audit_action: entry.action,
  request_id: entry.requestId ?? null,
  status: entry.status ?? "success",
  before: entry.before ?? null,
  after: entry.after ?? null,
  ...(entry.metadata ?? {}),
}
```

No new table. Uses existing `activity_events.metadata` JSONB field.

---

### TASK 3 — Standardize Read Wrappers

**Files: all 4 service files** (edit)

Add a shared `ServiceResult<T>` type to each (or a shared types file):

```typescript
export interface ServiceResult<T> {
  ok: boolean;
  data: T;
  error?: string;
}
```

Refactor each function to return `ServiceResult` instead of throwing:
- `listOrders` → `{ ok: true, data: { orders, total } }` or `{ ok: false, data: { orders: [], total: 0 }, error: "..." }`
- Same pattern for all 4 services

This makes them safe to call without try/catch, and aligns with the `requestHandler` response shape.

**Also add**: A shared file `src/lib/serviceLayer/types.ts` for the `ServiceResult` type so all services import from one place.

---

### TASK 4 — Strengthen Rollout Registry

**File: `src/lib/rolloutRegistry.ts`** (edit)

Add to `RolloutEntry` interface:
- `status: "active" | "disabled" | "deprecated"` — current flag state
- `notes?: string` — free-text for migration context

Update all 4 existing entries to include `status: "disabled"` and relevant notes.

---

### TASK 5 — Improve Function Inventory

**File: `src/lib/edgeFunctionInventory.ts`** (edit)

Add to `EdgeFunctionEntry` interface:
- `purpose: string` — one-line description
- `hasAuditLogging: boolean`
- `migrationPriority: "p0" | "p1" | "p2" | "p3"` — p0 = migrate first, p3 = last

Update all ~40 entries with these 3 new fields.

---

### Files Summary

| File | Action | Rollback |
|---|---|---|
| `supabase/functions/smoke-tests/index.ts` | Edit — add 2 checks, tighten shapes | Revert to current |
| `supabase/functions/_shared/auditLog.ts` | Edit — add requestId, status, timestamp | Revert to current |
| `src/lib/serviceLayer/types.ts` | New — shared ServiceResult type | Delete |
| `src/lib/serviceLayer/orderService.ts` | Edit — return ServiceResult | Revert to current |
| `src/lib/serviceLayer/productionService.ts` | Edit — return ServiceResult | Revert to current |
| `src/lib/serviceLayer/deliveryService.ts` | Edit — return ServiceResult | Revert to current |
| `src/lib/serviceLayer/roleService.ts` | Edit — return ServiceResult | Revert to current |
| `src/lib/rolloutRegistry.ts` | Edit — add status + notes fields | Revert to current |
| `src/lib/edgeFunctionInventory.ts` | Edit — add purpose, audit, priority | Revert to current |

### What MUST NOT Be Touched
1. Any existing edge function except smoke-tests
2. Any database table or column
3. Write paths in any service
4. Auth behavior or RoleGuard
5. Any route or component

### Assumptions
- `activity_events` accepts inserts with `entity_type: "smoke-test-probe"` (confirmed from schema)
- No consumers currently import the service layer files (confirmed: purely additive)
- Changing return types from throw-based to `ServiceResult` is safe because nothing calls these yet

### What Remains Weak After This Pass
- No service wrappers are wired into actual components yet (Wave 3 territory)
- No write-path wrappers exist
- Feature flags table exists but no admin UI to toggle them
- Audit helper is prepared but only integrated in smoke-tests
- `requestHandler` wrapper is not adopted by any production function yet

