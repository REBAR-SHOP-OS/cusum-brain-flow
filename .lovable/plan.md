

## Improve Background Theme Colors for Better Readability

### Problem
Current theme swatches are very dark and similar-looking, making it hard to distinguish them and causing poor text readability. The user wants brighter, more beautiful colors that maintain good contrast with text.

### Changes

**File**: `src/components/teamhub/BackgroundThemePicker.tsx`

Replace the 10 dark themes with brighter, more distinct options that keep text readable:

| Theme | Preview/Style |
|---|---|
| Default | Current dark background (no change) |
| Sky Blue | Soft blue gradient `hsl(210 60% 85%)` → `hsl(220 50% 75%)` |
| Mint Green | Fresh mint `hsl(160 40% 85%)` → `hsl(170 35% 75%)` |
| Lavender | Soft purple `hsl(270 40% 85%)` → `hsl(260 35% 78%)` |
| Peach | Warm peach `hsl(20 60% 88%)` → `hsl(15 50% 80%)` |
| Rose | Soft pink `hsl(340 40% 88%)` → `hsl(350 35% 80%)` |
| Sand | Warm beige `hsl(40 40% 88%)` → `hsl(35 35% 80%)` |
| Teal | Ocean teal `hsl(180 40% 82%)` → `hsl(190 35% 72%)` |
| Lilac | Light violet `hsl(280 35% 88%)` → `hsl(290 30% 80%)` |
| Cloud | Neutral gray `hsl(220 15% 90%)` → `hsl(220 10% 82%)` |

Since the app uses dark mode, all text is light-colored. These brighter backgrounds will create strong contrast, making text highly readable while looking visually appealing. The text color in messages will need to be set to dark for readability against these light backgrounds.

**Additional change**: Add `color: "hsl(222 47% 11%)"` (dark text) to each non-default theme's `style` object so message text remains readable on light backgrounds. Message bubbles and UI elements inside the chat area will also need dark text overrides.

**File**: `src/components/teamhub/MessageThread.tsx`
- When a non-default theme is active, add a CSS class that forces dark text color on the chat message area so all content remains readable against the light backgrounds.

| File | Change |
|---|---|
| `BackgroundThemePicker.tsx` | Replace dark swatches with bright, colorful gradients |
| `MessageThread.tsx` | Ensure text contrast adapts to light backgrounds |

