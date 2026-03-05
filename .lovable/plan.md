

# Auto Clock-In Flow for Kiosk Mode

## Current Behavior
- Face recognized at ≥75% → Shows confirm card with "Clock In" button (user must tap)
- Face recognized at ≥95% → Shows 3-second auto-punch countdown
- No match → Shows FirstTimeRegistration (asks name, registers, clocks in, enrolls face) ✅ Already works

## Problem
The auto-punch threshold is too high (95%). At 90% match (like the screenshot), the user still has to manually tap "Clock In". The user wants recognized faces to auto-clock without interaction.

## Changes

### 1. Lower auto-punch threshold in `src/pages/TimeClock.tsx`
- Change line 108: `result.confidence >= 95` → `result.confidence >= 75`
- This means any high-confidence match (≥75%) triggers the 3-second auto-punch countdown
- Low confidence (50-74%) still shows manual confirm buttons for safety

### 2. Shorten countdown for kiosk mode
- Reduce auto-punch countdown from 3 seconds to 2 seconds in kiosk mode for faster throughput

No other files need changes — the FirstTimeRegistration component already handles the "ask name → register → enroll face → clock in" flow for unrecognized faces.

