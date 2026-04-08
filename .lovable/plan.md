

# Move "Switch Mode" to Top-Left and Rename to "Back to Home"

## What Changes

The "SWITCH MODE" link at the bottom of the Office sidebar will be moved to the top of the sidebar (above the logo/header) and renamed to "Back to Home". It will link to `/home`.

## File: `src/components/office/OfficeSidebar.tsx`

### Remove from bottom (lines 78-87)
Delete the entire footer block containing the "Switch Mode" link.

### Add to top of sidebar (before the header/logo block)
Insert a new top bar with the ArrowLeft icon and "Back to Home" text, linking to `/home`:

```tsx
{/* Back to Home */}
<div className="px-3 py-2 border-b border-border">
  <Link
    to="/home"
    className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors uppercase"
  >
    <ArrowLeft className="w-3.5 h-3.5" />
    Back to Home
  </Link>
</div>
```

This places the navigation link at the very top of the sidebar, before the brand logo and "Office Tools" title.

