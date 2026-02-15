

# Add Server-Side Health Checklist to Speed Dashboard

## What Changes

### 1. Add a static "WordPress Health Checklist" section to SpeedDashboard.tsx

A new section below the existing Server-Side Recommendations that shows the 3 items from the Site Health report as a persistent, trackable checklist with localStorage persistence:

- **Autoloaded Options Bloat** (Critical) -- "Autoloaded data is 1.1 MB. Install Advanced Database Cleaner or WP-Optimize to purge stale transients and expired options. Target: under 800 KB."
- **No Persistent Object Cache** (Critical) -- "No Redis/Memcached detected. Enable persistent object caching via your hosting panel (most managed hosts offer one-click Redis). This eliminates redundant database queries on every page load."  
- **Consent API Non-Compliance** (Warning) -- "One or more plugins don't declare cookie consent via the WP Consent API. Update CookieYes/cookie plugins or replace with a Consent API-compatible alternative."

Each item will have a checkbox that persists to localStorage so you can track what you've done.

### 2. Enhance website-speed-audit to include these 3 items

Add these as hardcoded high-priority recommendations in the edge function so they always show up in the recommendations array (until manually dismissed). This ensures JARVIS also surfaces them when asked about speed.

## Technical Details

### SpeedDashboard.tsx changes:
- Import `Checkbox` from radix
- Add a `SERVER_HEALTH_ITEMS` constant array with the 3 items
- Add state managed via `localStorage` key `speed-health-checklist`
- Render a "WordPress Health Checklist" card section with checkboxes, severity badges, and descriptions
- Place it above the dynamic Server-Side Recommendations section

### website-speed-audit/index.ts changes:
- Add the 3 Site Health items as priority 0-2 recommendations with `requires_server_access: true`
- These appear before the existing dynamic recommendations

### Files Modified:
| File | Change |
|------|--------|
| `src/components/website/SpeedDashboard.tsx` | Add health checklist UI with localStorage-persisted checkboxes |
| `supabase/functions/website-speed-audit/index.ts` | Add 3 hardcoded Site Health recommendations at top priority |
