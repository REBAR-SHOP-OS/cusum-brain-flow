

## Remove `font-semibold` from Badge Component

### Change
**File: `src/components/ui/badge.tsx`** (line 7)

Remove the `font-semibold` class from the base `cva` string, changing badge text from semi-bold to normal weight.

### Before
```
"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ..."
```

### After
```
"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition-colors ..."
```

### Scope
- Only `src/components/ui/badge.tsx` is modified
- Single class removal, no other properties touched
- Affects all Badge instances application-wide (as intended)

