
# Shop Floor — Full Audit

Scope audited: `/shop-floor` hub + 9 sub-routes (Station Dashboard, Station View, Pool, Loading, Pickup, Clearance, Inventory Count, Delivery Ops, Cutter Planning) + all `src/components/shopfloor/*` (24 files, 5,708 LOC) + 16 shop-floor hooks + machine registry + linked edge functions (`manage-inventory`, `shape-vision`).

## ✅ What's clean (verified, no action)

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `vitest` | 72/72 pass (canvas/jsdom env warnings unrelated) |
| `React.lazy` in tab pages | None (HARD rule held) |
| `supabase.auth.getUser()` in shop-floor surface | None — Batch C/D refactor held across all 9 pages + 24 components + 16 hooks |
| `company_id` default fallbacks | None — strictly entity-derived |
| Machine lock / `cut_session_status` gates | Wired correctly in `CutterStationView` (lines 81, 160, 769, 808) and `BenderStationView:195` |
| Clearance routing (`cutting → clearance → complete`) | Enforced via DB triggers; UI matches |
| `tabular-nums` on counters | Present in `DashboardShellV2`, `MachineSpecsPanel`, etc. |

## ⚠️ Findings (4 issues)

### F1 — Realtime channel collisions (HIGH, HARD-rule)
`mem://architecture/realtime/subscription-standards` requires unique UUID per channel. 10 shop-floor hooks use deterministic names that collide when the same hook mounts in two tabs / two components / dev StrictMode double-mount:

| File | Channel name | Fix |
|---|---|---|
| `useBendBatches.ts:32` | `bend-batches-${companyId}` | append `-${crypto.randomUUID()}` |
| `useBenderBatches.ts:36` | `bender-batches-${machineId}` | same |
| `useCutPlans.ts:103` | `cut-plans-realtime-${companyId}` | same |
| `useWasteBank.ts:32` | `waste-bank-${companyId}` | same |
| `useClearanceData.ts:126` | `clearance-live-${companyId}` | same |
| `useStationData.ts:160` | `station-${machineId}` | same |
| `useProductionQueues.ts:61` | `production-queues-live-${companyId}` | same |
| `usePickupOrders.ts:65` | `pickup-live-${companyId}` | same |
| `useBundles.ts:29` | `bundles-${companyId}` | same |
| `useInventoryData.ts:150` | `inventory-live-${user?.id \|\| "global"}` | UUID + drop the `"global"` fallback (also violates "no default" rule) |

Only `useReadyToShip:87` does it right (`-${crypto.randomUUID()}`).

### F2 — Deletes without `.select('id')` (HIGH, HARD-rule)
`mem://architecture/database/deletion-verification` requires `.select('id')` so RLS blocks become detectable failures instead of silent no-ops.

| File | Lines |
|---|---|
| `pages/DeliveryOps.tsx` | 216, 217, 219, 235, 236, 238 (6 deletes, single + bulk path) |
| `pages/LoadingStation.tsx` | 271, 273 (cleanup-on-failure path) |
| `pages/PickupStation.tsx` | 237, 239 (cleanup-on-failure path) |

Fix: append `.select('id')` and treat empty result as RLS block (toast + throw).

### F3 — `MyJobsCard` brittle assignee match (MED)
`components/shopfloor/MyJobsCard.tsx:31` has a live `TODO`: `assigned_to` is a text column matched against `full_name`, not a profile ID. Breaks on rename / duplicate names / casing. Should query by `profile_id` (add column if missing) or at minimum `ilike` + `trim`.

### F4 — `useBendBatches` vs `useBenderBatches` naming confusion (LOW)
Two hooks one letter apart with different purposes (`BendQueueAdmin` queue vs single-machine queue). Not a bug, but high foot-gun risk. Optional rename: `useBendBatches` → `useBendQueue` for the admin one.

## Wave plan

### Wave 1 — Realtime UUID fix (F1)
- Edit 10 hooks: append `-${crypto.randomUUID()}` to `.channel()` strings.
- Drop `"global"` fallback in `useInventoryData.ts:150`; gate the effect on `user?.id` truthy.
- Add regression test `tests/regression/realtime/shopfloor-channel-uuids.test.ts` that greps the 10 files for the UUID suffix pattern.

### Wave 2 — Delete safety (F2)
- `DeliveryOps.tsx`: wrap each `.delete().eq(...)` with `.select('id')`; refactor to a single helper `safeDelete(table, col, id)` to dedupe the 6 call sites (single + bulk).
- `LoadingStation.tsx` + `PickupStation.tsx`: same `.select('id')` on the cleanup-on-failure deletes; if RLS blocks, surface a console.warn (cleanup path, don't re-throw to avoid masking the original error).
- Add regression test under `tests/regression/shopfloor/deletes-have-select-id.test.ts` (static grep over `pages/{DeliveryOps,LoadingStation,PickupStation}.tsx`).

### Wave 3 — MyJobsCard assignee (F3)
- Read `MyJobsCard.tsx`, switch the match to `profile_id` if the column exists on `work_orders` / `cut_plans` (DB inspect first); otherwise `ilike` + `trim` as a stopgap and keep the TODO with a migration note.
- Skip F4 unless you greenlight the rename — keeping it out of the audit fix to honor surgical-execution rule.

### Verification (every wave)
- Re-read each edited file.
- `bunx tsc --noEmit` clean.
- `bunx vitest run` 72→75 pass (3 new regression tests).
- Open `/shop-floor` preview, click into Station Dashboard + Delivery Ops, confirm no console errors and no `CHANNEL_ERROR` from realtime.
- Purge cache if SSH-deployed (`scripts/purge-cache.sh`).

## Out of scope (call out, don't fix)
- `BendQueueAdmin` / `WasteBankAdmin` / `BundleAdmin` admin tools — separate audit.
- Edge functions (`manage-inventory`, `shape-vision`) — both already use `requestHandler` + rate-limit; clean.
- No design / UX changes (hub looks correct in your screenshot).

Approve to start Wave 1.
