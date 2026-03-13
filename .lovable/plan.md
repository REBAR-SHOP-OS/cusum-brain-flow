

# Improve Kiosk Face ID Stability, Speed & Recognition Flow

## Current Issues Found

1. **Low-confidence matches (50-74%) go straight to "First Time?" registration** — The `face-recognize` edge function returns `matched: false` for anything below 75%, so even a 70% match shows "Enter your name" instead of "Is this you, [Name]?". This means returning employees who aren't perfectly recognized get asked for their name every time.

2. **No auto-reset after successful punch** — After clock in/out, the kiosk just sits there. The next person in line has to wait for manual reset.

3. **Auto-punch countdown is 2 seconds** — Could be faster for high-confidence, well-enrolled users.

## Changes

### 1. `supabase/functions/face-recognize/index.ts` — Return match data for 50-100% confidence

Change the `isMatched` threshold from `>= 75` to `>= 50` so that 50-74% matches still return profile data. The frontend already handles `low_confidence` state (50-74%) vs `matched` (75+) — it just never receives the data today.

```typescript
// Line 269-272: Change threshold from 75 to 50
const isMatched =
  resultData.matched_profile_id &&
  resultData.matched_profile_id !== "null" &&
  resultData.confidence >= 50;  // was 75
```

### 2. `src/pages/TimeClock.tsx` — Auto-reset & auto-scan after successful punch

In `handleConfirmPunch`, after the success toast, add a 4-second delay then auto-scan for the next person:

```typescript
// After face.reset() in handleConfirmPunch:
if (kioskMode) {
  setTimeout(() => {
    handleScan();
  }, 4000);
}
```

### 3. `src/pages/TimeClock.tsx` — Faster auto-punch for high-confidence

Reduce countdown from 2s to 1s for profiles with 3+ enrollments and 85%+ confidence (instant feel):

```typescript
// In handleScan:
if (result && result.confidence >= 85 && (result.enrollment_count ?? 0) >= 3) {
  setAutoPunchCountdown(1); // was 2
} else if (result && result.confidence >= 75 && (result.enrollment_count ?? 0) >= 3) {
  setAutoPunchCountdown(2);
}
```

### 4. `src/pages/TimeClock.tsx` — Show "Is this you?" for low-confidence instead of registration

Currently lines 273-280 show `FirstTimeRegistration` for `no_match` AND `error`. After the edge function fix (returning data for 50-74%), the `low_confidence` state will properly trigger `FaceRecognitionResult` with the "Confirm your identity" prompt instead of asking for name input.

No code change needed here — the existing `FaceRecognitionResult` component already handles `low_confidence` with a confirmation UI. The fix is entirely in the edge function returning the match data.

### 5. `src/pages/TimeClock.tsx` — Stability: prevent double-scan

Add a `scanningRef` guard to `handleScan` to prevent multiple concurrent scan calls:

```typescript
const scanningRef = useRef(false);
const handleScan = async () => {
  if (scanningRef.current) return;
  scanningRef.current = true;
  setShowRegistration(false);
  try {
    const result = await face.recognize();
    // ... countdown logic
  } finally {
    scanningRef.current = false;
  }
};
```

### Files
- `supabase/functions/face-recognize/index.ts` — lower match threshold to 50%
- `src/pages/TimeClock.tsx` — auto-reset/scan, faster countdown, double-scan guard

