

## Plan: Fix Build Error + Driver Page Bugs

### Root Cause
The production build fails because `PODCaptureDialog.tsx` line 77 uses `Record<string, unknown>` for the `delivery_stops` update — the Supabase client rejects this type in production builds. This is the same pattern already fixed in `DriverDropoff.tsx`.

### Changes

**`src/components/delivery/PODCaptureDialog.tsx`**
- Replace `Record<string, unknown>` (line 77) with an explicit typed object matching the `delivery_stops` Update schema:
  ```typescript
  const updates: {
    status: string;
    departure_time: string;
    pod_signature?: string;
    pod_photo_url?: string;
  } = {
    status: "completed",
    departure_time: new Date().toISOString(),
  };
  ```

### Additional Context (Not Build Errors)
The user's screenshots show "No deliveries assigned" on the Driver Dashboard — this is because the 2 existing deliveries have no `driver_name` or `driver_profile_id` set. This is a data issue, not a code bug. To test the driver flow, they need to assign a driver to a delivery first.

