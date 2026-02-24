

## Fix: "Create Delivery" Button Should Require Photos on All Loaded Items

### Problem
The "Create Delivery" button on `/shopfloor/loading` becomes active as soon as all items are tick-marked (loaded), even if some items are missing photo evidence. The Loading Station is described as requiring "item-by-item truck loading **with evidence**", so photos should be mandatory.

### Root Cause
In `src/pages/LoadingStation.tsx`, line 70:
```tsx
const allLoaded = totalItems > 0 && loadedCount >= totalItems;
```
This only checks if all items have `loaded = true`. It does not verify that each item also has a `photo_path`.

### Solution
Add a photo completeness check alongside the loaded check, so the button is only enabled when every item is both loaded AND has a photo.

### Changes

**File: `src/hooks/useLoadingChecklist.ts`**
- Add a new derived value `allPhotosComplete` that checks if every loaded checklist item has a non-null `photo_path`
- Export a `photoCount` alongside the existing `loadedCount`

**File: `src/pages/LoadingStation.tsx`**
- Import the new `photoCount` from the hook
- Update `allLoaded` logic to also require all items have photos:
  ```tsx
  const allLoaded = totalItems > 0 && loadedCount >= totalItems && photoCount >= totalItems;
  ```
- Update the button label to indicate missing photos when items are loaded but photos are incomplete:
  ```tsx
  {allLoaded ? "Create Delivery" : `${totalItems - Math.min(loadedCount, photoCount)} items remaining`}
  ```

### Technical Detail

In `useLoadingChecklist.ts`, add after line 134:
```typescript
const photoCount = checklistItems.filter(c => c.loaded && !!c.photo_path).length;
```

And return `photoCount` from the hook.

In `LoadingStation.tsx`, destructure `photoCount` from the hook and update the guard:
```typescript
const allLoaded = totalItems > 0 && loadedCount >= totalItems && photoCount >= totalItems;
```

This ensures the "Create Delivery" button stays disabled until every single item has both a tick mark and an uploaded photo, enforcing the evidence requirement.
