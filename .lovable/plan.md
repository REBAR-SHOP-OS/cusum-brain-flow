## Goal
On `/shopfloor/clearance`, the Manifest header (and project list buttons) currently shows the project name — which is usually the site address (e.g. "12 LEITH HILL RD"). It should instead show the **Remark** — the same value printed on the rebar tag (e.g. "6 METER STRAIGHTS 10MM $ 15MM"), which is the cut plan / extract session name.

## Source of "Remark"
On printed tags, `Remark` is fed from `extract_sessions.name` (via `PrintTags.tsx` → `sessionScope`). In the clearance hook we already expose this value as `plan_name` (= `cut_plans.name`, which mirrors the extract session name for a given plan).

## Changes

### 1. `src/hooks/useClearanceData.ts`
Group items by **plan/remark** instead of by project. Switch the grouping key from `project_id` to `cut_plan_id`, and use `plan_name` as the label. Fall back to `project_name` only when `plan_name` is empty.

```ts
const key = item.cut_plan_id || "__unassigned__";
const label = item.plan_name || item.project_name || "Unassigned";
```

Keep the same `byProjectKey` / `byProject` Map shape so `ClearanceStation.tsx` keeps working without further refactor (naming stays for surgical minimalism).

### 2. `src/pages/ClearanceStation.tsx`
- Update the active-items filter to match by `cut_plan_id` instead of `project_id`:
  ```ts
  items.filter((i) => (i.cut_plan_id || "__unassigned__") === selectedProjectKey)
  ```
- No UI label changes needed — the manifest already renders `displayLabel` which will now read the remark string.

## Out of scope
- No DB schema changes.
- No changes to RebarTagCard, PrintTags, or any other station — Cutting/Bending stations keep their existing grouping.
- "Project" wording in code variable names (`selectedProjectKey`, `byProjectKey`) is preserved to keep the diff surgical.

## Result
The Clearance Station list and manifest title will display the remark (e.g. "6 METER STRAIGHTS 10MM $ 15MM") matching the printed tag, instead of the site address.
