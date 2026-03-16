

# Replace CEO Dashboard Tab with Live Shop Monitoring

## Change
In `src/pages/AdminPanel.tsx`, replace the "CEO Dashboard" tab content with the `LiveMonitorView` component and remove the now-redundant separate "Live Monitor" tab.

### Edits
**`src/pages/AdminPanel.tsx`**:
1. Remove the `CEODashboardView` import (line 26)
2. Rename the "CEO Dashboard" tab trigger (line 156-159) to "Live Monitor" with the `Monitor` icon
3. Replace the `CEODashboardView` content (lines 318-322) with `<LiveMonitorView />`
4. Remove the old separate "Live Monitor" tab trigger (lines 160-163) and its `TabsContent` (lines 324-328)

Result: A single "Live Monitor" tab showing the Shop Floor HUD (production monitor, machine cards, production ledger) — matching exactly the screenshot reference.

