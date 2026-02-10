

## Move CEO Command, Time Clock, and Team Hub to Home Dashboard

### What's Changing

**Remove from ShopFloor Select Interface** (`src/pages/ShopFloor.tsx`):
- Remove the "CEO COMMAND", "TIME CLOCK", and "TEAM HUB" cards from the `hubCards` array (lines 25-49)
- The remaining cards (Office, Shop Floor, Clearance, Loading St., Delivery, Pickup St.) stay untouched

**Add to Home Dashboard** (`src/pages/Home.tsx`):
- Add a new "Workspaces" section between the Quick Actions and Automations sections
- Three new navigation cards styled consistently with the Home page design:
  - **CEO Command** -- navigates to `/office` with `{ section: "ceo-dashboard" }` state, Crown icon
  - **Time Clock** -- navigates to `/timeclock`, Clock icon
  - **Team Hub** -- navigates to `/team-hub`, MessageSquare icon
- Cards will use a clean grid layout (3 columns on desktop, stacked on mobile) with subtle gradient borders matching the app's dark theme

### Technical Details

**File 1: `src/pages/ShopFloor.tsx`**
- Delete entries for CEO COMMAND (lines 25-29), TIME CLOCK (lines 41-44), and TEAM HUB (lines 45-49) from the `hubCards` array

**File 2: `src/pages/Home.tsx`**
- Import `Crown`, `Clock`, `MessageSquare` from lucide-react
- Add a `workspaceCards` array with the three items (label, icon, route, state)
- Render a "Workspaces" section with a 3-column card grid between Quick Actions and Automations
- Each card uses `navigate()` on click, styled with the existing `Card` component

### Scope
- Only 2 files modified: `ShopFloor.tsx` and `Home.tsx`
- No backend, edge function, CSS, or other component changes
