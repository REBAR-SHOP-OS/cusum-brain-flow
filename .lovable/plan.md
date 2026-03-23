

## Wave 4 — Safe Wiring & Admin Tooling

### Summary

Wire the existing scaffolding into real consumers. All changes remain additive and rollback-safe.

---

### Task 1 — Wire FeatureFlagAdmin into AdminPanel

The `FeatureFlagAdmin` component exists but is not mounted anywhere.

**File**: `src/pages/AdminPanel.tsx`
- Add a new tab "Feature Flags" with icon `Flag`
- Add `TabsContent` rendering `<FeatureFlagAdmin />`
- Import `FeatureFlagAdmin` and `Flag` icon
- No behavior change to existing tabs

**Category**: Safe additive

---

### Task 2 — Wire roleService into AdminPanel user list

The AdminPanel currently fetches profiles with raw Supabase queries. Replace the role-fetching portion with `roleService.listCompanyUsersWithRoles` to validate the service wrapper in a real consumer.

**File**: `src/pages/AdminPanel.tsx`
- Use `listCompanyUsersWithRoles` alongside existing profile data to display roles
- Keep existing profile CRUD untouched — only add role display from the wrapper
- Fallback gracefully if service returns `ok: false`

**Category**: Safe additive (adds role badges, does not change existing employee cards)

---

### Task 3 — Migrate 3 more edge functions to handleRequest

Candidates (all low-risk, no core write paths):

| # | Function | Domain | Why safe |
|---|---|---|---|
| 1 | `quote-expiry-watchdog` | Quotes | Cron-style, reads + updates expired quotes only |
| 2 | `kiosk-lookup` | Auth | Read-only PIN lookup, no company scope needed |
| 3 | `manage-inventory` | Manufacturing | Action-based handler, company-scoped |

For each:
- Replace manual auth boilerplate with `handleRequest` + `rawResponse: true`
- Preserve exact response shapes
- Update `edgeFunctionInventory.ts` entries

**Category**: Safe import replacement

---

### Task 4 — Enable structured logging in migrated functions

Update the 8 functions now using `handleRequest` to use `createLogger` from `structuredLog.ts` via the `ctx.log` object already provided by the wrapper.

No behavior change — just structured JSON output instead of `console.log`.

Update rollout registry: set `use_structured_logging` phase to `"canary"`.

**Category**: Safe additive (logging only)

---

### Task 5 — Update inventory and registry

- Mark 3 newly migrated functions in `edgeFunctionInventory.ts`
- Update `rolloutRegistry.ts` notes to reflect current adoption count
- Total wrapper adoption after this wave: 11 functions

---

### Files Summary

| File | Action | Rollback |
|---|---|---|
| `src/pages/AdminPanel.tsx` | Add Feature Flags tab + role badges | Remove tab/import |
| `supabase/functions/quote-expiry-watchdog/index.ts` | handleRequest migration | Revert file |
| `supabase/functions/kiosk-lookup/index.ts` | handleRequest migration | Revert file |
| `supabase/functions/manage-inventory/index.ts` | handleRequest migration | Revert file |
| `src/lib/edgeFunctionInventory.ts` | Update 3 entries | Revert file |
| `src/lib/rolloutRegistry.ts` | Update notes + phase | Revert file |

### What MUST NOT Be Touched
- Route structure
- Database schema
- Auth session flow
- Core write paths (orders, deliveries, quotes creation)
- Existing admin panel tabs

