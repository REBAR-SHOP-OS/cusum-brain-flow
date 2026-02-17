

# Audit and Fix: Pickup Station and Shop Floor Logic

## Issues Found

### 1. forwardRef Console Warning
The console shows "Function components cannot be given refs" warnings for both `PickupStation` and `ReadyBundleList`. React is attempting to pass a ref to these components (likely from the router or error boundary). Both need to be wrapped with `React.forwardRef` to suppress the warning and prevent potential rendering issues.

### 2. Duplicate Navigation: "LOADING ST." and "DELIVERY" Both Go to `/deliveries`
On the Shop Floor hub, both the "LOADING ST." and "DELIVERY" cards navigate to the exact same `/deliveries` route. They should either be differentiated (e.g., Loading Station gets its own page or opens Deliveries with a specific filter) or consolidated into a single card.

**Fix**: Remove the duplicate "LOADING ST." card since "DELIVERY" already covers dispatch. Replace it with a direct link to the Deliveries page filtered for loading/prep if needed, or simply remove the duplication.

### 3. Bundle Grouping Key Fragility
In `useCompletedBundles`, bundles are grouped by `project_name` but the `cutPlanId` stored is only from the first plan encountered. If multiple cut plans share a project name, items merge under one `cutPlanId`. This also means the React `key` in `ReadyBundleList` (`bundle.cutPlanId`) could collide. Currently the data doesn't have this collision (each plan has a unique project name), but the logic should be hardened.

**Fix**: Use `cutPlanId` as the grouping key instead of `project_name`, so each plan is its own bundle card.

### 4. Plan Name Not Shown in Bundle List
The `ReadyBundleList` only shows `projectName` and item/piece counts. It doesn't display the `planName`, losing useful context for the operator.

**Fix**: Show `planName` in the subtitle when it differs from `projectName`.

## Changes

| File | Change |
|---|---|
| `src/pages/PickupStation.tsx` | Wrap with `React.forwardRef` to fix ref warning |
| `src/components/dispatch/ReadyBundleList.tsx` | Wrap with `React.forwardRef`; show plan name in subtitle |
| `src/pages/ShopFloor.tsx` | Remove duplicate "LOADING ST." card (DELIVERY already covers it) |
| `src/hooks/useCompletedBundles.ts` | Group by `cutPlanId` instead of `project_name` to prevent merge bugs |

