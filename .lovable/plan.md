

# Finish Wiring Penny + Forge: UI Mounting and Suggestion Engine Completion

No new tables, no schema changes, no architecture changes. This extends the existing system.

---

## What's Already Done

- `generate-suggestions` edge function already has Penny (missing QB ID) and Forge (idle machines with backlog) rules
- `AgentSuggestionsPanel` and `AgentSuggestionCard` components exist and work
- Vizzy cards are mounted on the CEO Portal

## What's Missing

### 1. Penny: Additional AR Aging Rules in Edge Function

The current Penny logic only covers "customers missing QB ID". The overdue AR logic exists but is assigned to **Vizzy**. Need to add Penny-specific AR aging suggestions with 30/60/90 day severity tiers that surface in the Accounting workspace.

**Changes to `supabase/functions/generate-suggestions/index.ts`:**
- Inside the `if (agentMap.penny)` block, add a query to `accounting_mirror` for overdue invoices, generating suggestions with:
  - 30-59 days: severity `info`
  - 60-89 days: severity `warning`
  - 90+ days: severity `critical`
  - Category: `penny_overdue_ar` (distinct from Vizzy's `overdue_ar`)
  - Actions: `[{ label: "View Invoice", action: "navigate", path: "/accounting?tab=invoices" }]`

### 2. Forge: Additional Rules in Edge Function

Current Forge logic covers idle machines. Add:
- **Jobs near due date with low completion**: Query `cut_plan_items` where `due_date` is within 3 days and completion < 50%. Category: `at_risk_job`. Severity: `warning` or `critical`.
- **Bender starving**: Compare cutter queue length vs bender queue length. If cutters have > 5 queued and benders have 0, generate a suggestion. Category: `bender_starving`.

### 3. Mount Penny Panel in Accounting Workspace

**File: `src/pages/AccountingWorkspace.tsx`**

Add `<AgentSuggestionsPanel agentCode="penny" agentName="Penny" />` at the top of the main content area, just above the tab content. It renders only when suggestions exist (already handles empty state internally).

Insert after line 163 (inside the scrollable content div), before the tab content:

```tsx
<AgentSuggestionsPanel agentCode="penny" agentName="Penny" />
```

### 4. Mount Forge Panel in Shop Floor Views

**File: `src/pages/ShopFloor.tsx`**

Add `<AgentSuggestionsPanel agentCode="forge" agentName="Forge" />` below the `MyJobsCard` component and above the hub cards grid.

**File: `src/pages/LiveMonitor.tsx`**

Add `<AgentSuggestionsPanel agentCode="forge" agentName="Forge" />` at the top of the page content, before the machine cards/filters.

---

## Technical Summary

### Files to Modify
- `supabase/functions/generate-suggestions/index.ts` -- add Penny AR aging + Forge at-risk jobs + bender starving rules
- `src/pages/AccountingWorkspace.tsx` -- import and mount `AgentSuggestionsPanel` for Penny
- `src/pages/ShopFloor.tsx` -- import and mount `AgentSuggestionsPanel` for Forge
- `src/pages/LiveMonitor.tsx` -- import and mount `AgentSuggestionsPanel` for Forge

### No Files to Create
### No Schema Changes
### No Breaking Changes to Vizzy

All new suggestion categories use distinct category strings to avoid dedup index conflicts with Vizzy's existing suggestions.

