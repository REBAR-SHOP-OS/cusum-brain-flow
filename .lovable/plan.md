

# Fix ADD Form: Always Show and Display Custom Items in List

## Problem
The Add form is hidden behind a toggle button. When a user adds a custom product, it should immediately appear in the items list below the defaults. The form should always be visible for quick additions.

## Changes

### `src/components/purchasing/PurchasingListPanel.tsx`
1. **Always show the Add form** — remove the `showAddForm` toggle state and always render the form fields below the status tabs (matching the screenshot layout)
2. **Remove the `+ Add` button** from the header since the form is always visible
3. **Separate custom items from default items** — filter out items that match a company default (by title+category) so they only show via `CompanyDefaultItems`, and custom-added items show separately below with their own section header like "Custom Items"
4. **After adding, call `refetch`** to ensure the new item appears immediately (realtime should handle it, but explicit refetch as backup)

### Display Logic Fix
Currently all DB items show in both the defaults section (as matches) AND the dynamic list below. Custom items (ones not matching any default) should be clearly shown in the dynamic list section below the separator.

Filter the items list to exclude default matches:
```typescript
const customItems = items.filter(item => 
  !COMPANY_DEFAULTS.some(d => d.title === item.title && d.category === item.category)
);
```

Then render `customItems` in the dynamic section instead of `items`, so users see their custom additions clearly.

