

# Logo Theme Always Active by Default

## Problem
The "Logo" chip in Visual Themes starts unselected, even though the code already applies the logo overlay unconditionally when `brandKit.logo_url` exists (line 152-160). The UI is misleading — it looks optional but it's always applied.

## Solution

In `src/components/social/ImageGeneratorDialog.tsx`:

1. **Initialize `selectedThemes` with "logo"** when `brandKit?.logo_url` exists — use a `useEffect` to set it once brandKit loads (since brandKit is async)
2. **On reset (`handleReset`)**, keep "logo" in the set instead of clearing to empty
3. **On close (`handleClose`)**, same — preserve "logo" in the reset
4. **Make the Logo chip visually distinct** — show it as always-on (non-toggleable) when logo exists, so users know it's permanently active

These changes align the UI state with the actual behavior (logo is always applied when available).

| File | Change |
|------|--------|
| `src/components/social/ImageGeneratorDialog.tsx` | Add useEffect to auto-select "logo"; preserve it on reset/close; make chip non-toggleable |

