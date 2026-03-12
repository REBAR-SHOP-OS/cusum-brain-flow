

# Show Kiosk-Registered Workers in Kiosk Status Tab

## Problem
The "Kiosk Status" tab currently shows ALL active profiles (same as Office/Shop tabs). When someone registers via the Face ID Kiosk (`kiosk-register`), they should specifically appear in this tab. The tab should only show workers who have punched via the kiosk (entries with `source: "kiosk"`).

## Approach
Filter the Kiosk Status tab to show only profiles that have at least one `time_clock_entries` record with `source = 'kiosk'` — these are the workers registered/punching through the kiosk system.

## Changes

### `src/pages/TimeClock.tsx`
- Replace `const kioskProfiles = activeProfiles` (line 495) with a filtered list based on `allEntries`
- Compute `kioskProfileIds` = unique profile IDs from entries where `source === "kiosk"` (from `allEntries`)
- Filter `activeProfiles` to only include profiles whose ID is in that set

### `src/hooks/useTimeClock.ts`
- The `allEntries` currently fetches `select("*")` which should include the `source` column
- Update the `TimeClockEntry` interface to include `source?: string | null` so the frontend can filter by it

## Result
The Kiosk Status tab will only show workers who have been registered or clocked in via the kiosk, not the entire team.

