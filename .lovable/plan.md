

# Return to Scan Screen After Punch

## Problem
After a successful clock in/out, the kiosk auto-triggers `handleScan()` after 3 seconds, which immediately starts scanning again. The user wants it to simply return to the idle screen showing the "Scan Face" button, so the next person can initiate the scan themselves.

## Change
In `src/pages/TimeClock.tsx`, line 162-164, remove the auto-scan timer after a successful punch:

**Current (line 162-164):**
```typescript
if (kioskMode) {
  setTimeout(() => { handleScan(); }, 3000);
}
```

**New:**
Remove this block entirely. After `face.reset()` on line 159, the state returns to `"idle"` which already shows the camera feed and the "Scan Face" button — exactly what the user wants.

### File
- `src/pages/TimeClock.tsx` — remove lines 162-164

