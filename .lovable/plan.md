

# Remove All Mock Data from CEO Dashboard

## What's Happening
Three components use hardcoded mock data from `src/components/ceo/mockData.ts` instead of real database data:

1. **DailyAssignments** — uses `mockExceptions` (fake invoices like "#4821", fake machine alerts)
2. **HealthScoreHero** — uses `mockAIExplainer` for the AI explain panel
3. **KpiCard** — uses `mockAIExplainer` for the AI explain panel

The real data already exists in `useCEODashboard` hook — it computes live `exceptions`, `arAgingBuckets`, `atRiskJobs`, and `capacityForecast` from actual database tables.

## Plan

### 1. Wire DailyAssignments to real data
- Change `DailyAssignments` to accept `exceptions` as a prop (from `useCEODashboard`)
- The real exceptions from `useCEODashboard` use type `CEOException` which lacks `customer`, `value`, and `actions` fields — adapt the component to work with `CEOException` type and generate contextual actions dynamically based on category
- Remove the `mockExceptions` import

### 2. Pass exceptions from CEOPortal
- In `CEOPortal.tsx`, call `useCEODashboard()` and pass `metrics.exceptions` to `<DailyAssignments exceptions={...} />`

### 3. Replace mockAIExplainer with a placeholder in HealthScoreHero and KpiCard
- Remove the `mockAIExplainer` import from both files
- Since there's no live AI explainer endpoint yet, show a "No AI analysis available" empty state in the ExplainPanel, or generate a simple static summary from the actual props (score, label, value) instead of fake text
- This ensures no fabricated business data appears

### 4. Delete mockData.ts
- Remove `src/components/ceo/mockData.ts` entirely — no other files depend on it after the above changes

### Files Changed
- `src/components/ceo/DailyAssignments.tsx` — accept props, remove mock import, adapt to `CEOException` type
- `src/components/ceo/HealthScoreHero.tsx` — remove mock import, use empty/derived explainer data
- `src/components/ceo/KpiCard.tsx` — remove mock import, use empty/derived explainer data
- `src/pages/CEOPortal.tsx` — add `useCEODashboard`, pass real exceptions to DailyAssignments
- `src/components/ceo/mockData.ts` — delete

