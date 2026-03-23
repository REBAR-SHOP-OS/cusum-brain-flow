

## Fix Wave 2 Audit Issues — 5 Targeted Corrections

### Issue 1: Tenant Scoping on By-ID Reads

**Problem**: `getOrderById`, `getProductionTaskById`, `getDeliveryById` fetch by `id` alone — no `company_id` filter. A caller could read another tenant's record.

**Fix**: Add `companyId` as required parameter to all three functions.

**`src/lib/serviceLayer/orderService.ts`**
```typescript
export async function getOrderById(orderId: string, companyId: string): Promise<ServiceResult<any>> {
  // .eq("id", orderId).eq("company_id", companyId)
}
```

Same pattern for `productionService.ts` and `deliveryService.ts`.

Nothing calls these yet, so the signature change is safe.

---

### Issue 2: Schema Validation — Confirmed Correct

After checking `types.ts` and 90+ usages across the codebase:
- `quotations` — real table, used everywhere (not "quotes")
- `deliveries` — real table, 94 matches across 10 files
- `work_orders` — real table, 60 matches across 9 files
- `orders` — real table

**No table name corrections needed.** All wrappers point to correct tables.

---

### Issue 3: Profile/User Mapping Bug in roleService

**Problem**: `listCompanyUsersWithRoles` does:
```typescript
.select("id, full_name, email, company_id, user_roles!inner(role)")
.eq("company_id", companyId)
```
Then maps `userId: p.id` (profile UUID).

But `user_roles.user_id` references `auth.users.id`, NOT `profiles.id`. The join `user_roles!inner(role)` tries to match on a FK relationship that doesn't exist between `profiles.id` and `user_roles.user_id`.

**Fix**: The join won't work via `!inner` because there's no FK between profiles and user_roles. Instead, use a two-step approach:
1. Fetch profiles for the company
2. Fetch roles for those user_ids
3. Merge client-side

Also fix `userId` to return `p.user_id` (auth user ID) instead of `p.id` (profile ID), since that's what `user_roles` links to.

---

### Issue 4: Smoke Test Comment Truthfulness

**Problem**: Top-level JSDoc says "Read-only checks" but the function inserts into `activity_events` twice (audit probe + execution log).

**Fix**: Update the JSDoc comment to:
```typescript
/**
 * Smoke test / health check endpoint.
 * Non-destructive checks against core tables and services to verify system health.
 * NOTE: Performs controlled audit writes to activity_events for probe verification
 * and execution logging. No core business write paths are touched.
 */
```

---

### Issue 5: Audit Probe Safety

**Problem**: Probe rows lack clear metadata distinguishing them from real audit entries.

**Fix**: Add explicit metadata to both the probe insert and the execution log insert:
```typescript
// Probe insert:
metadata: { smoke_test: true, probe: true, purpose: "audit_pipeline_verification" }

// Execution log:
metadata: { smoke_test: true, purpose: "execution_log", checks: [...] }
```

Also add `source: "smoke-tests"` consistently (already present but confirm on both inserts).

---

### Files Changed

| File | Change | Rollback |
|---|---|---|
| `src/lib/serviceLayer/orderService.ts` | Add `companyId` param to `getOrderById` | Revert file |
| `src/lib/serviceLayer/productionService.ts` | Add `companyId` param to `getProductionTaskById` | Revert file |
| `src/lib/serviceLayer/deliveryService.ts` | Add `companyId` param to `getDeliveryById` | Revert file |
| `src/lib/serviceLayer/roleService.ts` | Fix join logic, return `user_id` not `id` | Revert file |
| `supabase/functions/smoke-tests/index.ts` | Fix comments, add metadata to probes | Revert file |

### Confirmed
- Table names `quotations`, `deliveries`, `work_orders`, `orders` are all correct
- All by-ID wrappers will require `companyId` after fix
- No write paths touched (smoke test writes are controlled audit probes only)
- No existing consumers break (nothing imports these service files yet)

