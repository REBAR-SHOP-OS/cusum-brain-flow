

# Add "Team Status Shop" Tab & Rename "Team Status" to "Team Status Office"

## What
- Rename the current "Team Status" tab to **"Team Status Office"** — it will only show users with `@rebar.shop` email domain
- Add a new **"Team Status Shop"** tab — it will show all users **without** `@rebar.shop` email domain

## Changes

### File: `src/pages/TimeClock.tsx`

1. **Add `Warehouse` icon import** (or `HardHat`/`Factory` from lucide-react) for the Shop tab

2. **Split `activeProfiles` into two lists** (~line 175):
   - `officeProfiles` = profiles with email ending in `@rebar.shop`
   - `shopProfiles` = profiles without `@rebar.shop` email

3. **Rename tab** (line 352-354): `Team Status` → `Team Status Office`, keep `Users` icon

4. **Add new tab trigger** after the office tab:
   - Value: `team-status-shop`, icon: `Factory` or `HardHat`, label: "Team Status Shop"

5. **Update existing `TabsContent value="team-status"`** to use `officeProfiles` instead of `activeProfiles`

6. **Add new `TabsContent value="team-status-shop"`** — same card layout as team-status but iterating over `shopProfiles`

Both tabs will share the same card rendering logic (profile avatar, clock-in status, duration badge). I'll extract the shared rendering into a helper to avoid duplication.

