

## Wave 2 — Control, Visibility & Read-Side Structure

All changes are additive. No existing files modified except extending `smoke-tests/index.ts`.

---

### TASK 1 — Upgrade Smoke Tests

**File: `supabase/functions/smoke-tests/index.ts`** (edit existing)

Add 5 new read-only checks to the existing smoke test function:

| Check | What it does |
|---|---|
| `auth_service_available` | Verify `supabase.auth.admin.listUsers({ perPage: 1 })` responds without error |
| `quote_response_shape` | Fetch 1 quotation, assert it has `id`, `company_id`, `status`, `created_at` |
| `order_response_shape` | Fetch 1 order, assert it has `id`, `company_id`, `status` |
| `feature_flag_fetch` | Fetch from `feature_flags`, verify array response with `flag_key` field |
| `role_lookup` | Query `user_roles` with `.limit(1)`, verify it returns without error and has `role` field |

All use service client, all are `SELECT` only, zero mutations.

**Safety**: Extends existing endpoint. No new function folder. Rollback = revert to current file.

---

### TASK 2 — Rollout Governance Config

**File: `src/lib/rolloutRegistry.ts`** (new)

A typed, machine-readable registry of all feature flags and their rollout metadata:

```typescript
export interface RolloutEntry {
  flagKey: string;
  owner: string;
  domain: string;
  targetRoles: string[];
  targetUserIds: string[];
  phase: "off" | "canary" | "percentage" | "ga";
  rollbackSteps: string;
  dependencies: string[];
}

export const rolloutRegistry: RolloutEntry[] = [
  { flagKey: "use_new_request_handler", owner: "platform", domain: "infra", ... },
  { flagKey: "use_new_quote_engine", owner: "sales", domain: "quotes", ... },
  { flagKey: "use_new_pipeline_ui", owner: "sales", domain: "crm", ... },
  { flagKey: "use_structured_logging", owner: "platform", domain: "infra", ... },
];
```

No UI. Just a typed config file that can be imported by admin tools later.

**Safety**: New file, nothing imports it yet. Rollback = delete file.

---

### TASK 3 — Safe Domain Read Wrappers

Four new files in `src/lib/serviceLayer/`:

**`orderService.ts`** — Read-only order queries
- `listOrders(companyId, options?)` — paginated, filterable by status
- `getOrderById(orderId)` — single order fetch

**`productionService.ts`** — Read-only production queries
- `listProductionTasks(companyId, options?)` — paginated
- `getProductionTaskById(taskId)`

**`deliveryService.ts`** — Read-only delivery queries  
- `listDeliveries(companyId, options?)` — paginated
- `getDeliveryById(deliveryId)`

**`roleService.ts`** — Read-only role/capability queries
- `getUserRoles(userId)` — returns roles array
- `hasUserRole(userId, role)` — boolean check
- `listCompanyUsersWithRoles(companyId)` — joins profiles + user_roles

All follow the same pattern as `quoteService.ts`: `(supabase as any).from(table).select(...)`, throw on error, return typed results.

**Safety**: All new files. No existing code calls them. Read-only queries only. Rollback = delete files.

---

### TASK 4 — Critical Function Inventory

**File: `src/lib/edgeFunctionInventory.ts`** (new)

Machine-readable JSON-like TypeScript array categorizing ~40 critical edge functions:

```typescript
export interface EdgeFunctionEntry {
  name: string;
  domain: "auth" | "quotes" | "orders" | "manufacturing" | "delivery" | "accounting" | "comms" | "ai" | "admin";
  risk: "critical" | "high" | "medium" | "low";
  usesSharedWrapper: boolean;
  hasFeatureFlag: boolean;
  hasSmokeCoverage: boolean;
  notes?: string;
}
```

Covers key functions like:
- **auth**: `google-oauth`, `kiosk-lookup`, `kiosk-punch`
- **quotes**: `quote-engine`, `ai-generate-quotation`, `quote-expiry-watchdog`
- **orders**: `convert-quote-to-order`, `odoo-sync-order-lines`
- **manufacturing**: `manage-machine`, `log-machine-run`, `manage-bend`, `manage-extract`, `manage-inventory`
- **delivery**: `smart-dispatch`, `validate-clearance-photo`
- **accounting**: `qb-sync-engine`, `qb-audit`, `qb-webhook`, `payroll-engine`
- **comms**: `gmail-sync`, `gmail-send`, `ringcentral-sync`, `ringcentral-webhook`

**Safety**: New file, pure data. Rollback = delete file.

---

### TASK 5 — Safe Audit Helpers

**File: `supabase/functions/_shared/auditLog.ts`** (new)

```typescript
export interface AuditEntry {
  action: string;        // e.g. "role_change", "order_delete", "config_update"
  actorId: string;
  targetEntity: string;
  targetId: string;
  companyId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(client, entry: AuditEntry): Promise<void>
// Best-effort insert into activity_events with event_type = "audit"
// Uses existing activity_events table — no new table needed
// Never throws — logs errors to structured logger
```

**One example integration**: Add audit logging to `smoke-tests/index.ts` — log when smoke tests are run (who ran them, results summary). This is zero-risk since smoke tests are already non-critical.

**Safety**: New shared file. One tiny addition to smoke-tests. Rollback = delete file + revert smoke-tests.

---

### Files Summary

| File | Action | Safe? | Rollback |
|---|---|---|---|
| `supabase/functions/smoke-tests/index.ts` | Edit — add 5 checks + audit | Yes — extends existing, read-only | Revert to current |
| `src/lib/rolloutRegistry.ts` | New | Yes — nothing imports it | Delete |
| `src/lib/serviceLayer/orderService.ts` | New | Yes — read-only wrapper | Delete |
| `src/lib/serviceLayer/productionService.ts` | New | Yes — read-only wrapper | Delete |
| `src/lib/serviceLayer/deliveryService.ts` | New | Yes — read-only wrapper | Delete |
| `src/lib/serviceLayer/roleService.ts` | New | Yes — read-only wrapper | Delete |
| `src/lib/edgeFunctionInventory.ts` | New | Yes — pure data | Delete |
| `supabase/functions/_shared/auditLog.ts` | New | Yes — helper only | Delete |

### What MUST NOT Be Touched

1. Any existing edge function (except smoke-tests)
2. Any database table or column
3. `_shared/auth.ts` signature
4. Any route or component
5. Write-path logic in any service

### Next Recommended Migration Order (after Wave 2)

1. Wire `orderService` into one order-list component (read path only)
2. Wire `roleService` into admin panel role display
3. Migrate `build-learning-pairs` to `requestHandler` (lowest risk function)
4. Enable `use_structured_logging` flag for one domain
5. Add write wrappers for quotes (Phase 4 territory)

