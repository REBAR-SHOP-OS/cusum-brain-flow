

# Two Fixes: Cutter-02 Bar Size Filter + Screenshot Viewport Capture

## Issue 1: Cutter-02 Shows 10M/15M Items (Should Only Show 20M+)

### Problem
`useStationData` fetches all `cut_plan_items` from plans assigned to the machine. It does not cross-reference `machine_capabilities` to filter out bar codes the machine shouldn't handle. So Cutter-02 (which per auto-routing should only handle 20M+) still shows 10M/15M items if they happen to be in an assigned plan.

### Fix
In `src/hooks/useStationData.ts`, after fetching cutter items, also fetch `machine_capabilities` for the machine and filter items to only include bar codes present in that machine's capabilities.

**Changes to `src/hooks/useStationData.ts`** (cutter branch, ~line 109-131):

```typescript
// After fetching planIds, also fetch machine capabilities
const { data: caps } = await supabase
  .from("machine_capabilities")
  .select("bar_code")
  .eq("machine_id", machineId);

const allowedBarCodes = caps?.length
  ? new Set(caps.map(c => c.bar_code))
  : null; // null = no filtering (legacy fallback)

const { data: items, error: itemsError } = await supabase
  .from("cut_plan_items")
  .select("*")
  .in("cut_plan_id", planIds)
  .or("phase.eq.queued,phase.eq.cutting");

if (itemsError) throw itemsError;

return (items || [])
  .filter((item: Record<string, unknown>) => {
    // Filter by machine capabilities if available
    if (allowedBarCodes && !allowedBarCodes.has(item.bar_code as string)) return false;
    return true;
  })
  .map(/* ... existing mapping ... */);
```

---

## Issue 2: Screenshot Captures Top of Page Instead of Current View

### Problem
In `src/components/feedback/ScreenshotFeedbackButton.tsx`, when the page is not "heavy" and not an overlay, `forceViewportOnly` is `false`. This causes html2canvas to try capturing the full scrollable content starting from the top, rather than the current viewport.

### Fix
Add `/shopfloor/station` to the routes that force viewport-only capture (like `/pipeline` already does).

**Changes to `src/components/feedback/ScreenshotFeedbackButton.tsx`** (line ~46):

```typescript
const isPipelineRoute = path === "/pipeline" || path.startsWith("/pipeline/");
const isStationRoute = path.startsWith("/shopfloor/station");
// ...
const forceViewportOnly = isOverlay || isPipelineRoute || isStationRoute || isHeavyRoute;
```

This ensures the screenshot captures exactly what's visible on screen, not the full scrollable page.

---

## Summary
- **File 1:** `src/hooks/useStationData.ts` — add `machine_capabilities` fetch + filter for cutter items
- **File 2:** `src/components/feedback/ScreenshotFeedbackButton.tsx` — add station routes to viewport-only capture list

No database changes needed.

