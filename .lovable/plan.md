

# Map Ref to Reference, Remove Address from Tag

## Problem
The Ref section currently shows `reference || customer` with the address displayed below it. The user wants the Ref field to map strictly to the `reference` value — no address line.

## Changes

### `src/components/office/RebarTagCard.tsx` (lines 161-168)
- Remove the `{address && ...}` line that displays the address below the Ref
- Keep `Ref:` showing `reference || customer || "—"` (or just `reference || "—"` if customer fallback is also unwanted)

### `src/components/office/RebarTagCard.tsx` (props interface)
- Remove `address` from `RebarTagCardProps` since it's no longer used

### `src/pages/PrintTags.tsx` (line 130)
- Remove the `address` prop passed to `RebarTagCard`

### `src/utils/generateZpl.ts` (line 101)
- Already maps `reference` correctly — no change needed

## Impact
- Tag layout becomes cleaner — Ref section shows only the reference value
- Address fetching logic in PrintTags becomes unused but harmless (can be cleaned up)

