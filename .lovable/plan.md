

# Remove Website and SEO Tiles from Home Dashboard

## What Changes

One file: `src/pages/Home.tsx`

Remove the two workspace tiles ("Website" and "SEO") from the Workspaces grid on the Home page. These are currently shown only to admin users but will be removed for ALL users.

## Technical Detail

In `src/pages/Home.tsx`, lines 189-192, delete the conditional spread that adds the Website and SEO entries to the workspaces array:

```
// DELETE these lines:
...(isAdmin ? [
  { label: "Website", icon: Globe, route: "/website", ... },
  { label: "SEO", icon: Search, route: "/seo", ... },
] : []),
```

Also remove the unused imports `Globe` and `Search` from the lucide-react import (line 17) since no other code references them.

## What Does NOT Change

- The `/website` and `/seo` routes remain functional (accessible via direct URL or sidebar)
- No data or features are deleted
- All other workspace tiles (CEO Portal, Time Clock, Team Hub, Transcribe) remain unchanged
- No database or backend changes needed

## Acceptance Test

- Log in as any user (admin or non-admin) and navigate to `/home`
- Website and SEO cards do not appear in the Workspaces grid
- All four remaining tiles render correctly

