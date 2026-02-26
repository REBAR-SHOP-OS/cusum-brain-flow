

## Plan: Fix Deliveries Page Bugs & Add Driver Assignment

### Issues Found

1. **"Today" tab shows 0 deliveries** — The delivery has `scheduled_date = 2026-02-26 00:00:00+00` (timestamp with time zone). The code does `d.scheduled_date?.split("T")[0]` to get the date, but Supabase returns timestamps that may not have a `T` separator. More critically, `today` is derived from `new Date().toISOString().split("T")[0]` which works, but the DB value returned via the Supabase JS client should have the `T`. This needs investigation — the delivery IS scheduled for today but shows under 0. The real issue: line 222-224 categorises "today" as `dateOnly <= today` but only from `pendingDeliveries`. Since the delivery IS pending and scheduled for today, this should work. Let me verify the actual returned format matches.

   **Actually** — the Supabase JS client returns ISO strings with `T`, so `split("T")` works. The delivery date `2026-02-26` equals `today` (`2026-02-26`), so `dateOnly <= today` is true. The delivery should appear in "Today". But the screenshot shows the user has **Driver Mode ON** — that's the filter. With Driver Mode on, `filteredDeliveries` is empty because `driver_name` is null, so all tabs show 0.

2. **Driver Mode filters out all deliveries** — `filteredDeliveries` (line 203) requires `d.driver_name === myProfile.full_name`, but `driver_name` is null. Also only checks `driver_name`, not `driver_profile_id`.

3. **No UI to assign a driver** to a delivery — there's no way to set `driver_name` or `driver_profile_id`.

### Changes

**`src/pages/Deliveries.tsx`**

1. **Fix Driver Mode filter** — Also match `driver_profile_id` (like DriverDashboard does), and when Driver Mode is on, still show unassigned deliveries (so the user can self-assign):
   ```typescript
   const filteredDeliveries = driverMode && myProfile
     ? deliveries.filter(d => 
         d.driver_name === myProfile.full_name || 
         d.driver_profile_id === myProfile.id ||
         !d.driver_name  // Show unassigned so driver can claim
       )
     : deliveries;
   ```

2. **Add driver self-assign button** — In the detail panel, when Driver Mode is on and no driver is assigned, show a "Claim Delivery" button that sets `driver_name` and `driver_profile_id` on the delivery.

3. **Add "Assign Driver" dropdown** — In the detail panel header (non-driver-mode), add a simple button to assign `driver_name` to the current user (or type a name). This ensures deliveries can get a driver assigned.

4. **Update Delivery interface** — Add `driver_profile_id` to the `Delivery` interface since the column exists in the DB.

5. **Fix myProfile query** — Currently only fetches `full_name`. Also fetch `id` so we can match `driver_profile_id` and set it on claim.

