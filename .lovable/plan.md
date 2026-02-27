

## Plan: Fix Build Failure + Wire Signature Improvements

### Build Failure
The production build fails due to `vite-plugin-image-optimizer` crashing on large/already-optimized PNGs. The plugin tries to re-optimize images that are already small, producing larger outputs and eventually crashes.

**Fix in `vite.config.ts`:** Increase the skip threshold or disable PNG optimization to prevent the crash.

### Signature Issue
The file `DeliveryConfirmationModal.tsx` referenced in the bug report does not exist in the codebase. The actual signature capture components are:

1. **`PODCaptureDialog.tsx`** (used on `/deliveries` and `/driver-dashboard`) — The `SignaturePad` is always visible and not gated behind a photo. The submit button requires either a signature OR a photo (`!signatureData && !photoFile`). No disabled "Sign" button exists here.

2. **`DriverDropoff.tsx`** (used on `/driver/dropoff/:stopId`) — The "Tap to Sign" buttons are plain `<button>` elements, always enabled. The `canSubmit` for "Complete Drop-Off" requires signature + photo + all items checked — this is correct behavior for the final submit.

### What Needs Fixing

**`PODCaptureDialog.tsx`** — The submit button condition `disabled={saving || (!signatureData && !photoFile)}` allows submitting with ONLY a photo and no signature, which is too loose. For proper POD, both should be captured but independently (no ordering dependency).

**Changes:**
1. **`vite.config.ts`** — Disable or raise thresholds for the image optimizer plugin to fix the production build crash.

2. **`PODCaptureDialog.tsx`** — Keep signature and photo sections both always enabled (already the case). Update submit button to require BOTH signature and photo for a complete POD: `disabled={saving || !signatureData || !photoFile}`. Add visual checkmarks showing which items are complete.

3. **`DriverDropoff.tsx`** — No changes needed; signature buttons are already independently enabled.

### Technical Details
- The `vite-plugin-image-optimizer` crash occurs because already-optimized PNGs produce larger re-optimized outputs. The plugin logs `+186%[3` then crashes.
- The `PODCaptureDialog` `SignaturePad` component is embedded inline (not behind a button), so there is no "disabled Sign button" to fix — the component itself is the fix described in the stack overflow hint but adapted to our codebase structure.

