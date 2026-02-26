

## Plan: Fix Build + Ensure Signature is Inside Packing Slip

### Build Error
The build error output was truncated — the actual TypeScript error isn't visible. The `DriverDropoff.tsx` code looks correct. I'll do a defensive cleanup to ensure the build passes:
- Remove the `(stop as any)` cast on line 67 and use optional chaining on the typed response instead
- Ensure the `deliveries` join select returns typed data by using a proper type assertion

### Current State
The signatures are **already inside** the packing slip border in the current code (lines 296-317). The customer sees the full item table with checkmarks, then signs at the bottom — exactly like the attached image. No UI changes needed for the signature placement.

### Changes to `src/pages/DriverDropoff.tsx`

1. **Fix potential build issue**: Change the `delivery_stops` query to explicitly type the join result, removing the `as any` cast:
   ```typescript
   const deliveryNumber = stop?.deliveries?.delivery_number || "";
   ```
   The select `"*, deliveries(delivery_number)"` returns a typed join — the `as any` is unnecessary if we handle the type properly.

2. **Defensive typing**: Add a proper interface for the stop data with the joined delivery to avoid any type inference issues in strict production builds.

### Files
- **Edit**: `src/pages/DriverDropoff.tsx` — fix typing to resolve build error

