

# Redesign Pixel Chat Input — Horizontal Professional Layout

## Problem
The Pixel agent's chat input toolbar (Style icons, Product icons, Size selector) is arranged vertically/wrapped, creating a tall cluttered box that looks unprofessional.

## Solution
Restructure the bottom toolbar into a clean **single horizontal row** with collapsible popover panels instead of inline icon grids.

### `src/components/chat/ChatInput.tsx`

**1. Replace inline Style/Products/Size grids with compact popover buttons:**

Instead of rendering all 10 style icons + 7 product icons + 3 size buttons directly in the toolbar row, show three compact pill buttons:

```text
[ 📎 Attach ] [ 🧠 Gemini ▾ ] [ 🎨 Style (3) ▾ ] [ 📦 Products (2) ▾ ] [ ⬜ 1:1 ▾ ] ──── [ ➤ Send ]
```

Each pill opens a `Popover` with the icon grid inside. The pill shows a count badge when items are selected.

**2. Specific changes (lines 525-653):**

- **Style section** (lines 525-573): Wrap the existing icon grid in a `Popover`. The trigger is a compact pill button showing `🎨 Style` with selection count. The `PopoverContent` contains the 2×5 icon grid.

- **Products section** (lines 575-617): Same pattern — pill trigger `📦 Products` with count, popover contains the 7 product icons.

- **Size section** (lines 619-653): Convert to a single pill button showing the current ratio (e.g., `⬜ 1:1`). Click opens popover with the 3 ratio options.

- Remove the vertical dividers (`w-px h-8 bg-border`) between sections.

**3. Toolbar layout stays as a single `flex items-center gap-1` row:**

```text
Before: [attach] [model] [── 10 style icons ──] [── 7 product icons ──] [── 3 size buttons ──] [send]
After:  [attach] [model] [style pill] [products pill] [size pill]                    [spacer] [send]
```

**4. Popover content styling:**
- Dark background matching the theme (`bg-popover`)
- Grid layout: styles in 5×2, products in 4×2
- Same icon buttons as current, just inside the popover
- Smooth open/close animation

### Files Changed
- `src/components/chat/ChatInput.tsx` — Refactor lines 525-653 (Style/Products/Size sections) into popover-based pills. ~80 lines replaced.

