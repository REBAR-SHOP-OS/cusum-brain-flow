## Scope

Re-implement the requested clearance audit upgrades inside the existing files — no new module layout, no route rename. The canonical route stays `/shopfloor/clearance` (`src/pages/ClearanceStation.tsx`), wired through `src/App.tsx`.

## Files touched

- `src/hooks/useClearanceData.ts` — derive `is_sample`, triage bucket, urgency score per item.
- `src/pages/ClearanceStation.tsx` — header health pill, sample toggle, triage badges, urgency sort, sample-action gating.
- `src/components/clearance/ClearanceCard.tsx` — accept `disabledReason` prop; hide Manual Verify when sample-only / read-only. Evidence gate (`assertEvidenceComplete`) already enforced — left as-is.
- `tests/regression/shopfloor/clearance-triage-and-sample-gate.test.ts` — new regression locking the new behavior in source.

No DB migration. No router changes. No new routes/redirects (commit referenced a module layout that does not exist here).

## Behavior

1. **Live-data health indicator (header pill)**
   - Green "LIVE · N items" when at least one non-sample item is present and the last query refetched within 60s.
   - Amber "STALE · Xs" when refetch is older than 60s.
   - Red "OFFLINE" when `error` is set or `items` is empty AND realtime channel is `CLOSED`.
   - Uses existing `useClearanceData` query meta + `dataUpdatedAt` from `useQuery`.

2. **Sample-data detection + toggle**
   - `is_sample` derived in the hook by heuristic on `plan_name`/`customer_name`/`barlist_name` matching `/^(sample|demo|test|seed)\b/i`. Centralized in one helper.
   - New "Show sample data" toggle in the header (off by default).
   - When live (non-sample) items exist, sample rows are hidden by default; toggling shows them with a "SAMPLE" badge on each card and customer row.
   - When only sample data exists, they are shown automatically with a banner "Showing sample data — no live clearance items".

3. **Disabled sample actions**
   - `ClearanceCard` for `is_sample` rows: Manual Verify, photo upload, and storage-zone edits are disabled with tooltip "Sample row — actions disabled".
   - Auto Clearance mode entry is blocked when only sample items are pending on the manifest.

4. **Evidence-gated manual clear** — already enforced via `assertEvidenceComplete` in `ClearanceCard` (line 258). Plan adds a regression test that asserts the call site still precedes the `status: "cleared"` update, and that sample rows never reach that path.

5. **Triage breakdown badges** (header strip on list view + per-manifest summary)
   - Buckets derived per item:
     - `cleared` — `evidence_status === "cleared"`.
     - `needs_fix` — evidence row exists with `mismatch_reason` populated or `verification_state === "manual_review"`.
     - `upstream_not_ready` — parent `barlist_status` not in (`released`,`approved`) OR `cut_plan_status` not in (`cutting`,`clearance`,`complete`).
     - `stale` — pending > 24h since `created_at` (workspace TZ via existing `useWorkspaceSettings`, falls back to local).
     - `pending` — everything else not cleared.
   - Render as 5 small badges using existing `Badge` variants + semantic tokens.

6. **Urgency sorting**
   - Within a manifest: sort by bucket priority `needs_fix > stale > upstream_not_ready > pending > cleared`, then oldest `created_at` first.
   - Customer/manifest list: bump customers with any `needs_fix` to the top, then `stale`, then existing newest-first order.

## Technical notes

- All new colors via existing semantic tokens (`destructive`, `amber-500/40` already used, `primary`, `muted-foreground`). No new CSS variables.
- Hook returns add `is_sample`, `triage`, `urgency` on each `ClearanceItem` — purely additive, existing consumers untouched.
- Realtime channel UUID pattern unchanged.
- No backend write paths added; sample rows are read-only by UI guard, not DB constraint.

## Verification

- Re-read both edited files after change.
- `bunx vitest run tests/regression/shopfloor/clearance-triage-and-sample-gate.test.ts tests/regression/shopfloor/auto-clearance-tag-gate.test.ts tests/regression/shopfloor/clearance-strict-3field-match.test.ts`.
- Navigate preview to `/shopfloor/clearance`, confirm: health pill renders, badges count correctly, toggle hides/shows sample rows, Manual Verify disabled on sample card.
