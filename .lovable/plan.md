

# Remove Auto-Scan from Face ID Kiosk

## Problem
The kiosk automatically triggers `handleScan()` in three places without waiting for the user to press "Scan Face":
1. On entering kiosk mode (line 106-110) — auto-scans after 2s delay
2. After a successful punch (line 196-198) — auto-scans after 4s for "next person"
3. After registration completes (lines 317, 326) — auto-scans after 5s

## Fix

**File:** `src/pages/TimeClock.tsx`

Remove all three auto-scan triggers:

1. **Lines 105-110** — Delete the `setTimeout(() => handleScan(), 2000)` block inside `enterKioskMode`
2. **Lines 194-199** — Delete the `if (kioskMode) { setTimeout(() => handleScan(), 4000) }` block inside `handleConfirmPunch`
3. **Line 317** — Change `setTimeout(() => handleScan(), 5000)` to just `/* user must tap Scan Face */` (inside FirstTimeRegistration onComplete)
4. **Line 326** — Same change for the second registration callback

After these changes, scanning only happens when the user explicitly taps the "Scan Face" button.

