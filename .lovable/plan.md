
# Fix: CEO Portal Tab Should Show LiveMonitorView

The CEO Portal tab currently renders `CEODashboards` (Operations Control with Extracts/Production/etc.), but the user wants it to show `LiveMonitorView` — the original CEO Portal HUD with live clock, KPI pulse strip, machine cards, etc.

## Change

### `src/pages/AdminPanel.tsx`
1. Replace the `CEODashboards` import with `LiveMonitorView` from `@/components/office/LiveMonitorView`
2. In the `ceo-portal` TabsContent (line 345), replace `<CEODashboards />` with `<LiveMonitorView />`
