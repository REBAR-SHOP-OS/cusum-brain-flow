

# Add Permanent Company Default Items to Purchasing List

## What
Display a fixed set of default company items (Office + Workshop categories) that always appear in the purchasing list panel, each with check/uncheck buttons. These are **client-side static items** shown alongside any database items, so they persist visually even if not in the DB.

## Approach
Rather than seeding the DB (which ties to a specific company_id and is hard to maintain), we define the defaults as a **constant array in code** and render them as a separate "Company Defaults" section above the dynamic items list. Each default item gets its own bought/not-bought toggle that syncs with the DB.

### Option chosen: Hybrid approach
- Define the static list as a constant in `PurchasingListPanel.tsx`
- On load, check which default items already exist in the DB (match by title + category)
- For items NOT in the DB yet, show them with a "not purchased" state — clicking the check button will **create** the item in the DB and mark it purchased
- For items already in the DB, show their actual purchased state from the DB
- Items are grouped under "Office" and "Workshop" section headers

## Changes

### 1. `src/components/purchasing/PurchasingListPanel.tsx`
- Add a `COMPANY_DEFAULTS` constant with all 37 items organized by category
- Render a "Company Defaults" section with two groups: **Office** and **Workshop**
- Each item row: `[✓] [✗] Item Title [category badge]`
- Merge logic: match DB items by title+category to determine purchased state
- When user clicks ✓ on a default not yet in DB → call `addItem` with `is_purchased: true`
- When user clicks ✗ on a purchased default → call `togglePurchased`
- This section appears **above** the regular dynamic items list, separated by a divider

### 2. `src/hooks/usePurchasingList.ts`
- Add an `addItemAsPurchased` method that inserts an item already marked as purchased (for when user checks a default item)

## Default Items

**Office (15 items):** Paper Towels, Coffee, Tea, Cups, Milk, Paper, Garbage Bags, Snacks, AA Batteries, AAA Batteries, Stationery, Bottled Water (for Espresso Machine), Plates, Spoons, Forks

**Workshop (19 items):** Coffee, Tea, Water for Coffee Machine, Small Drinking Cups, Small Coffee Cups, Plates, Spoons, Powdered Milk, Sugar, Thin Wire (for packaging), Forklift Oil Filter, Forklift Oil, Forklift Air Filter, Grease (for grease pump), Gasoline, Salt (for entrance / winter use), Paint for Sawhorses, Orange Paint (for Stirrup Machine), 220V Switch for Welding Machine, 220V Outlet for Welding Machine, Straps for Fire Extinguisher Pallets, Winter Gloves, Thick Black Markers, Rebar Tie Wire (for tying gun), Forklift Snow Chains

## Files Changed

| File | Change |
|------|--------|
| `src/components/purchasing/PurchasingListPanel.tsx` | Add COMPANY_DEFAULTS constant, render grouped default items with check/uncheck buttons |
| `src/hooks/usePurchasingList.ts` | Add `addItemAsPurchased` method |

