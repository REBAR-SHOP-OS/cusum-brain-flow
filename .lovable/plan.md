

# Add Card Editor Icon to Sidebar

## Problem
The Card Editor panel is a hidden tab — it only opens programmatically when "Edit Card" is clicked. It has no icon in the left sidebar, making it feel disconnected from the other tools.

## Solution
Add the Card Editor as a visible tab in the sidebar icon strip, using a `CreditCard` or `SquarePen` icon from lucide-react, so users can access it like any other tool.

## Changes

### `src/components/ad-director/ProVideoEditor.tsx`

1. **Import** `SquarePen` icon from `lucide-react`
2. **Add to TABS array** (line 51, before "settings"):
   ```ts
   { id: "card-editor", label: "Card Editor", icon: <SquarePen className="w-4 h-4" /> },
   ```
   This makes it appear as a regular icon in the left sidebar alongside all other tools.

No other files need changes — the tab content rendering for `card-editor` already exists at line 1131.

