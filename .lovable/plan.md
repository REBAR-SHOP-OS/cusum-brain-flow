

# Convert Purchasing Agent to English + Seed Default Company Items

## Overview
Two changes: (1) Convert all Persian text in the purchasing UI, hook toasts, and agent prompt to English. (2) Seed the purchasing list with ~34 permanent default items grouped by "Office" and "Workshop" categories.

## Changes

### 1. `src/components/purchasing/PurchasingListPanel.tsx` — All English
- Status tabs: "All", "Not Purchased", "Purchased"
- Header: "Company Purchasing List"
- Calendar button: "Calendar" / "Clear Filter"
- Add button: "+ Add"
- Form placeholders: "Item name...", "Qty", "Category (optional)"
- Priority labels: "Urgent", "Normal", "Low"
- Submit button: "Add"
- Loading/empty states: "Loading...", "List is empty"
- Priority display: "Urgent" / "Normal" / "Low"

### 2. `src/hooks/usePurchasingList.ts` — English toasts
- "Error adding item", "Item added", "Error updating", "Error deleting", "Deleted"

### 3. `supabase/functions/_shared/agents/purchasing.ts` — English prompt
- Remove Persian from the system prompt
- Categories: Materials, Tools, Office Supplies, Safety, Misc
- Respond always in English

### 4. `src/components/agent/agentConfigs.ts` — English greeting
- Change greeting from Persian to English: "Hi! I'm Kala, your Purchasing & Procurement agent."
- Change placeholder to English

### 5. Seed default items via database INSERT
Insert 34 items into `purchasing_list_items` with:
- **Office category**: Toilet Paper, Paper Towels, Coffee, Tea, Cups, Milk, Paper, Garbage Bags, Snacks, AA Batteries, AAA Batteries, Stationery, Bottled Water (Espresso Machine), Plates, Spoons, Forks
- **Workshop category**: Coffee, Tea, Water for Coffee Machine, Small Drinking Cups, Small Coffee Cups, Plates, Spoons, Powdered Milk, Sugar, Thin Wire (packaging), Forklift Oil Filter, Forklift Oil, Forklift Air Filter, Grease (grease pump), Gasoline, Salt (entrance/winter), Paint for Sawhorses, Orange Paint (Stirrup Machine), 220V Switch (Welding Machine), 220V Outlet (Welding Machine), Straps (Fire Extinguisher Pallets), Winter Gloves, Thick Black Markers, Rebar Tie Wire (tying gun), Forklift Snow Chains

These will be seeded for the user's company. Priority: medium. Status: not purchased.

## Files Changed

| File | Change |
|------|--------|
| `src/components/purchasing/PurchasingListPanel.tsx` | All text → English |
| `src/hooks/usePurchasingList.ts` | Toast messages → English |
| `supabase/functions/_shared/agents/purchasing.ts` | System prompt → English |
| `src/components/agent/agentConfigs.ts` | Greeting/placeholder → English |
| DB INSERT | Seed 34 default items |

