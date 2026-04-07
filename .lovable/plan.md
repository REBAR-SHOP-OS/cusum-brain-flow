

# Update Vizzy Suggestions Panel

## Issues Found

1. **Single-agent view for CEO** — The Home page picks ONE agent's suggestions based on role mapping. The CEO (super admin) only sees Vizzy suggestions, missing Penny, Forge, and other agent suggestions entirely. All 20 shown are Vizzy overdue AR cards.

2. **Grouped card hardcodes "overdue invoices"** — `GroupedSuggestionCard` line 60: `{customerName} — {count} overdue invoices` is hardcoded. If the group contains mixed categories (e.g., blocked production + overdue), the label is wrong.

3. **No bulk actions for the full panel** — Individual cards and groups have Snooze/Dismiss, but there's no way to clear all 20 at once.

4. **No severity sorting** — Suggestions display in `created_at desc` order. A critical $190 item (140 days overdue) appears below warning items.

5. **Grouping threshold too high** — Only groups when >= 3 items from same customer. Two invoices from the same customer appear as separate cards instead of grouped.

## Plan

### File: `src/hooks/useAgentSuggestions.ts`
- Add a new hook `useAllAgentSuggestions()` that loads suggestions from ALL agents (no `agent_id` filter) for super admins
- Sort results: critical first, then warning, then info; within same severity, by `created_at desc`

### File: `src/components/agent/AgentSuggestionsPanel.tsx`
- For super admins: use `useAllAgentSuggestions()` instead of single-agent hook
- Show agent name per-card dynamically (e.g., "Vizzy suggests" vs "Penny suggests" vs "Forge suggests")
- Change grouping threshold from 3 to 2
- Add "Dismiss All" and "Snooze All" buttons at the panel header level when count > 5
- Pass agent name from suggestion data rather than hardcoded prop

### File: `src/components/agent/GroupedSuggestionCard.tsx`
- Replace hardcoded "overdue invoices" with dynamic category label
- Map category to readable text: `overdue_ar` → "overdue invoices", `zero_total` → "$0 orders", `blocked_production` → "blocked orders", etc.

### File: `src/pages/Home.tsx`
- Pass `isSuperAdmin` flag to `AgentSuggestionsPanel` to trigger multi-agent mode
- Keep existing single-agent behavior for non-super-admin users

## Technical Details

- New `useAllAgentSuggestions` query joins `suggestions` with `agents` table to get agent code/name per suggestion
- Severity sort order: `{ critical: 0, warning: 1, info: 2 }`
- Category label map added as a const in `GroupedSuggestionCard`
- Bulk snooze/dismiss calls `Promise.all` on all visible suggestion IDs
- No database changes needed

## Impact
- 4 files changed
- CEO sees all agent suggestions in one unified panel, sorted by severity
- Non-admin users see their agent's suggestions unchanged
- Grouped cards show accurate category labels
- Critical items surface to the top

