

## Plan: Full-Page Driver Drop-Off Screen

### Problem
After loading, drivers use a tiny dialog (PODCaptureDialog) to capture signature and photo. It's cramped and not mobile-friendly — hard to sign on a small canvas inside a modal.

### Solution
Create a dedicated full-page route `/driver/dropoff/:stopId` that provides a large, touch-friendly experience optimized for drivers on phones at job sites.

### Implementation

#### 1. Create `src/pages/DriverDropoff.tsx`
A full-screen, mobile-first page with:
- **Header**: Stop address + delivery number + "Navigate" button (Google Maps link)
- **Site Photo section**: Large tap-to-capture area using camera, with retake option
- **Signature section**: Full-width `SignaturePad` component (already exists) — much larger than the dialog version
- **"Complete Drop-Off" button**: Disabled until both photo AND signature are captured. On submit, uploads photo + signature to storage, updates `delivery_stops` (status, pod_signature, pod_photo_url, departure_time), updates packing_slips, and auto-completes the delivery if all stops are terminal — same logic as `PODCaptureDialog` but in a full page
- After success, navigates back to `/driver`

#### 2. Add route in `src/App.tsx`
```
<Route path="/driver/dropoff/:stopId" element={<P><DriverDropoff /></P>} />
```

#### 3. Update `src/pages/DriverDashboard.tsx`
Change the "Capture POD" button to navigate to `/driver/dropoff/${stop.id}` instead of opening the PODCaptureDialog. Keep the dialog as fallback for the office Deliveries page.

### UI Layout (mobile-first)
```text
┌──────────────────────────┐
│ ← Back    DROP-OFF       │
│ 123 Main St, Toronto     │
│ [Navigate]               │
├──────────────────────────┤
│                          │
│   📷 SITE DROP PHOTO     │
│   ┌──────────────────┐   │
│   │  Tap to Capture  │   │
│   └──────────────────┘   │
│                          │
│   ✍️ CUSTOMER SIGNATURE  │
│   ┌──────────────────┐   │
│   │                  │   │
│   │  SignaturePad    │   │
│   │                  │   │
│   └──────────────────┘   │
│                          │
├──────────────────────────┤
│ [  ✓ Complete Drop-Off ] │
└──────────────────────────┘
```

### Files
- **Create**: `src/pages/DriverDropoff.tsx`
- **Edit**: `src/App.tsx` (add route)
- **Edit**: `src/pages/DriverDashboard.tsx` (link to new page instead of dialog)

