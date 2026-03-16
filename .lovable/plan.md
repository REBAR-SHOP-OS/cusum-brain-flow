

# Plan: Add "CEO Portal" Tab to Admin Panel

## What
Add a new "CEO Portal" tab after "Audit Trail" in the Admin Panel tab bar (the circled area in the screenshot). This tab will render the existing `CEODashboards` component.

## Changes

### `src/pages/AdminPanel.tsx`
1. **Import**: Add `BarChart3` icon from lucide-react and import `CEODashboards` from `@/components/dashboards/CEODashboards`
2. **Tab trigger** (after line 175): Add a new `TabsTrigger` with value `"ceo-portal"`, icon `BarChart3`, label "CEO Portal"
3. **Tab content** (after line 342): Add a new `TabsContent` rendering `<CEODashboards />` inside a `ScrollArea`

This reuses the existing `CEODashboards` component which already has all six sub-tabs (Extracts, Production, Shop, Dispatch, Cash, Payroll).

