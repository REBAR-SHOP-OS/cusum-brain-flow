

# Fix Auto-Split "(Small)" Manifests Appearing as User-Uploaded

## Root Cause

In `src/components/shopfloor/ShopFloorProductionQueue.tsx` (line 329), when a cut plan has mixed bar sizes (small 10M/15M + large 20M+), the system auto-creates a new plan named `"${plan.name} (Small)"` and moves small-bar items into it. These auto-split plans then appear in the Detailed List alongside user-uploaded manifests with no distinction.

## Solution

Two changes:

### 1. Tag auto-split plans at creation time
Add a metadata marker when the split plan is created in `ShopFloorProductionQueue.tsx` so the system knows it's auto-generated. Since `cut_plans` doesn't have a metadata column, we'll use a simple naming convention that's already in place (`(Small)` suffix) and add a visual badge in the UI.

### 2. Show a visual indicator in DetailedListView
In `src/components/office/DetailedListView.tsx`, detect plans with the `(Small)` suffix and show a small badge like "AUTO-SPLIT" next to the name. This makes it clear the user didn't upload them manually.

Additionally, group auto-split plans visually under their parent by rendering them indented/muted with a link icon.

### Changes

**`src/components/office/DetailedListView.tsx`**
- Detect plans ending with `(Small)` suffix
- Render an "AUTO-SPLIT" badge next to those plan names
- Style them slightly muted/indented to visually separate from user-uploaded manifests

**No database changes needed** — the `(Small)` naming convention is already consistent.

