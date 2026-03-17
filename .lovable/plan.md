

## Problem
When a user adds a custom item with category "Office" or "Workshop", it appears in the separate "Custom Items" section at the bottom instead of within the corresponding category group (Office/Workshop). The user expects the item to show up inline within its category.

## Plan

### `src/components/purchasing/CompanyDefaultItems.tsx`
- Accept a new prop `customItems: PurchasingItem[]` — custom DB items that match Office/Workshop categories
- In `renderGroup`, after rendering the default items, also render any custom items whose `category` matches that group
- Custom items render with the same row style but include quantity, priority badge, and a delete button (like the current custom items section)

### `src/components/purchasing/PurchasingListPanel.tsx`
- Split `customItems` into three groups:
  - `officeCustom` — `category === "Office"`
  - `workshopCustom` — `category === "Workshop"`
  - `otherCustom` — everything else (no category or other categories)
- Pass `officeCustom` and `workshopCustom` into `CompanyDefaultItems` as a new `customItems` prop
- The "Custom Items" section at the bottom only shows `otherCustom` (items without Office/Workshop category)

### Result
- User adds "دستمال" with category "Office" → appears at the end of the Office section
- User adds item with category "Workshop" → appears at the end of the Workshop section
- Items with no category or other categories → still appear in "Custom Items" section

