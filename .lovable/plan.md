

# Force `ai@rebar.shop` into Face Kiosk mode permanently

## What the user is asking
وقتی با اکانت `ai@rebar.shop` (اکانت کیوسک) وارد سیستم می‌شود، صفحه `/timeclock` باید **همیشه و فقط** در حالت Face ID Kiosk باز شود و از Face Memory enrolled photos برای clock in / clock out افراد استفاده کند. حالت دستی (manual) و سوییچ Face ID نباید برای این اکانت قابل دسترسی باشد.

## Current behavior (problem)
- `ai@rebar.shop` opens `/timeclock` and sees the regular manual Time Clock page (screenshot confirms).
- Kiosk only auto-enters when URL has `?kiosk=1` (TimeClock.tsx line 117–122).
- "Exit Kiosk" button is visible inside kiosk and lets the device account drop back to manual mode.
- Result: the kiosk device can accidentally land on the manual screen and stop using Face Memory for punches.

## Fix (surgical, additive)

Single file: `src/pages/TimeClock.tsx`

1. **Auto-enter kiosk on every load when user is `ai@rebar.shop`** — extend the existing `useEffect` so kiosk mode is forced for that email regardless of `?kiosk=1`. Camera starts immediately, fullscreen requested.

2. **Hide the "Exit Kiosk" button for `ai@rebar.shop`** — kiosk cannot be exited from the device account. (Admins like `radin@`, `sattar@` who log in elsewhere are unaffected; they don't normally use this account.)

3. **Hide the Face ID toggle and bypass the manual rendering branch entirely for `ai@rebar.shop`** — defensive; if for any reason the page renders before the auto-enter effect fires, return a minimal "Loading kiosk…" splash instead of the manual UI, so a half-second flash of the wrong screen never lets someone interact with manual mode.

4. **Keep existing logic intact** — `handleScan` already uses `face.recognize()` which calls `face-recognize` edge function reading `face_enrollments` (the Face Memory). No backend changes needed; the kiosk will keep matching against the 27 enrolled photos shown in the side panel.

## Files touched
- `src/pages/TimeClock.tsx` — three targeted edits described above.

## Untouched
- `useFaceRecognition`, `face-recognize` edge function, `face_enrollments` table, `kiosk-punch` edge function, FaceMemoryPanel, all other accounts' Time Clock experience.

## Validation
- Login as `ai@rebar.shop`, navigate to `/timeclock` → device immediately enters Face Kiosk fullscreen with camera live; no manual UI ever shown.
- "Exit Kiosk" button absent for this account; only the "Memory" button (for whitelisted admins viewing on this device) remains.
- Scan a face → matches against Face Memory enrollments → auto-punches via `kiosk-punch` (existing flow).
- Other users (`radin@`, `sattar@`, `neel@`, etc.) still see the normal Time Clock page exactly as before.

