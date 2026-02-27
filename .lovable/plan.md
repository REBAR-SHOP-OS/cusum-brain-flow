

## Plan: Fix Driver Dashboard Empty State + Improve Signature Reliability

### Issues Found
1. **Driver Dashboard shows 0 deliveries** — Query on line 111 uses `.or(driver_profile_id.eq...,driver_name.eq...)` which excludes unassigned deliveries (where both are null). Same bug we fixed on the Deliveries page.
2. **No way to claim unassigned deliveries** — No self-assign UI on Driver Dashboard detail view.
3. **SignatureModal canvas** — `resetAll` clears canvas synchronously but ref may not be mounted yet in Radix portal. Adding `setTimeout` and `minHeight` for reliability.

### Changes

**`src/pages/DriverDashboard.tsx`**

1. **Add `driver_profile_id` to Delivery interface** (line 33-41)

2. **Fix query filter** (line 111) — Add `driver_name.is.null` to the `.or()` clause:
   ```
   .or(`driver_profile_id.eq.${myProfile!.id},driver_name.eq.${myProfile!.full_name},driver_name.is.null`)
   ```

3. **Add "Claim This Delivery" button** (lines 222-233) — Before the Start Delivery button, show a claim button when delivery is unassigned. On click, update `driver_name` and `driver_profile_id` on the delivery. Only show Start Delivery when driver is assigned.

4. **Update empty state text** — "No deliveries available" instead of "No deliveries assigned"

**`src/components/delivery/SignatureModal.tsx`**

5. **Fix `resetAll` timing** (lines 29-39) — Add `setTimeout(50)` for canvas clear to wait for portal mount. Reset `isDrawing` state.

6. **Add `minHeight` and `display: block`** to canvas container (lines 144-165) — Ensures canvas has visible dimensions even before interaction.

