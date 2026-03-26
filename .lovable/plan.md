

# Always Show Send Button on Scene Custom Prompt

## Problem
The Send (paper plane) icon button next to "Custom prompt..." input uses `variant="ghost"` styling, making it nearly invisible against the dark background. The user wants it always clearly visible.

## Fix
**File: `src/components/ad-director/AdDirectorContent.tsx`** (line 594-602)

Change the Send button from `variant="ghost"` to a visible styled button with a persistent teal/primary background so it's always visible regardless of background:

```tsx
// Before
<Button size="sm" variant="ghost" className="h-7 w-7 p-0" ...>

// After
<Button size="sm" className="h-7 w-7 p-0 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0" ...>
```

This ensures the send icon is always visible with a solid background color, matching the teal style shown in the screenshot.

## Files Changed
- `src/components/ad-director/AdDirectorContent.tsx` — update Send button styling (line 594-597)

