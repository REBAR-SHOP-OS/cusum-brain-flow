

# Analysis: No "Restricted Area" Component Exists

## Finding

After thorough investigation of the codebase, **there is no "Restricted Area" section or component** anywhere in the station detail pages. The components in `/src/components/shopfloor/` include:

- `CutterStationView.tsx` — the cutter station (shown in the screenshot)
- `BenderStationView.tsx` — bender station
- `StationHeader.tsx` — shared header with Supervisor toggle
- `ProductionCard.tsx` — individual production items
- `SlotTracker.tsx` — bar slot management
- `CutEngine.tsx` — cut configuration panel

None of these contain a "Restricted Area" card with a user list and action icons. The screenshot shows a standard cutter station page with production controls — no user management section is visible.

## What Needs to Happen

Since this is a **new feature** (not a bug fix), we need to **create** a Restricted Area component. Here's the plan:

### 1. Create `src/components/shopfloor/RestrictedAreaCard.tsx`

A new card component that:
- Displays a list of users with special access to the station
- Shows each user's name, role, and avatar
- Has two action buttons per user:
  - **Ban** (temporary block) — `Ban` icon, logs to console as placeholder
  - **Remove** (permanent) — `Trash2` icon, logs to console as placeholder
- Both actions wrapped in `Tooltip` for clarity

### 2. Integrate into `CutterStationView.tsx`

Add the `RestrictedAreaCard` to the station view, likely in the right sidebar area alongside the CutEngine panel, or below it. Since no data source exists yet, the component will use a static mock list of users initially.

### 3. Data model consideration

Currently there is no database table for station-level user access restrictions. The initial implementation will use **mock data** with a `TODO` comment indicating where a database query should be added later.

| File | Action |
|------|--------|
| `src/components/shopfloor/RestrictedAreaCard.tsx` | **Create** — new component with user list + Ban/Remove actions |
| `src/components/shopfloor/CutterStationView.tsx` | **Edit** — import and render RestrictedAreaCard in the station layout |

