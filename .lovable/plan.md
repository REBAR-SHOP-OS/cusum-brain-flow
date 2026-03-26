

# Fix Bottom Toolbar Button Contrast

## Problem
The bottom toolbar buttons (Duration 15s, Style, Products, Video Model) use `bg-muted/40 border-border text-muted-foreground` which is nearly invisible against the dark background.

## Changes

### `src/components/ad-director/ChatPromptBar.tsx`

Update the default (inactive) state styling for these 4 buttons to match the Ratio button which already uses the correct style:

**Lines 304, 342, 400, 459** — Change:
```
"bg-muted/40 border-border text-muted-foreground hover:bg-muted"
```
To:
```
"bg-white/10 border-white/20 text-white/80 hover:bg-white/20"
```

Also update the auto-generate sparkles button (line 502):
```
"bg-muted/40 border-border text-muted-foreground opacity-40 cursor-not-allowed"
```
To:
```
"bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
```

| File | Change |
|---|---|
| `ChatPromptBar.tsx` | Update 5 button default styles from muted to white/translucent for visibility |

