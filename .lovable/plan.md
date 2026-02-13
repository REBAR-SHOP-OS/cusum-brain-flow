

# Fix: Sanitize Non-ASCII Characters in Storage Keys

## Problem
Filenames with accented characters (e.g., "EEC SAINT-RENE-GOUPIL") cause "Invalid key" errors because Supabase Storage rejects non-ASCII characters in paths. The current sanitization regex only handles a specific set of special characters but misses accented letters and other unicode characters.

## Fix

### File: `src/components/admin/OdooDumpImportDialog.tsx` (line 145)

Replace the current sanitization regex with one that also strips all non-ASCII characters:

**Before:**
```typescript
const safeName = m.name.replace(/[~#%&{}\[\]()<>\\*?/$!'":@+`|=]/g, "_");
```

**After:**
```typescript
const safeName = m.name.replace(/[^\w.\-]/g, "_");
```

This uses a whitelist approach: only allow word characters (`a-z`, `A-Z`, `0-9`, `_`), dots, and hyphens. Everything else -- including accented characters, spaces, and all special symbols -- gets replaced with underscores.

This is a single-line change. The currently running import can be aborted and re-run; already-uploaded files will be upserted harmlessly.
