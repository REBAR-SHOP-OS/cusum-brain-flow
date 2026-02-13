
# Fix: Add Missing Characters to Filename Sanitization

## Problem
3 out of 407 files failed with "Invalid key" errors. The filenames contain square brackets `[`, `]` and parentheses `(`, `)` which are not included in the current sanitization regex, causing Supabase storage to reject them.

Examples from the screenshot:
- `S6-0[1].pdf` -- brackets
- `[F1 to 3].pdf` -- brackets
- `(3).pdf` -- parentheses

## Fix

### File: `src/components/admin/OdooDumpImportDialog.tsx`

**Line 145** -- Update the sanitization regex to include `[`, `]`, `(`, `)`:

```typescript
// Before:
const safeName = m.name.replace(/[~#%&{}\\<>*?/$!'":@+`|=]/g, "_");

// After:
const safeName = m.name.replace(/[~#%&{}\[\]()<>\\*?/$!'":@+`|=]/g, "_");
```

This is a one-line change. After applying it, re-running the import will process those 3 files successfully.
