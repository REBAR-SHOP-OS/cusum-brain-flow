

# Fix: Failed posts must show red, Published posts show green

## Problem
Cards with `status === "failed"` fall through to the default gray styling (`bg-muted/50 border-border`) instead of showing red. The card background color cases at line 264-278 handle `published`, `scheduled`, `draft`, `declined` but miss `failed`.

Similarly, the status text color (lines 319-326) has no `failed` case — it defaults to gray `text-muted-foreground`.

## Changes — single file: `src/components/social/SocialCalendar.tsx`

### 1. Card background: add `failed` case (red)
After the `declined` case (line 276), before the default fallback:
```
status === "failed"
  ? "bg-red-500/10 border-red-500/40"
```

### 2. Status text color: add `failed` case (red)
In the status label className (line 319-326), add:
```
status === "failed" ? "text-red-600 font-medium"
```

### 3. Also handle `publishing` card background (blue/neutral indicator)
```
status === "publishing"
  ? "bg-blue-500/10 border-blue-500/30"
```

No other files change. No logic or route changes.

