

## Rename "Office Portal" to "Office Tools"

**WHAT:** Change the sidebar header text from "Office Portal" to "Office Tools"

**WHERE:** Two files need a one-line text change each:
1. `src/components/office/OfficeSidebar.tsx` (line 62) — the sidebar header label
2. `src/pages/OfficePortal.tsx` (line 58, mobile top bar uses `activeSection` so no change needed there)

**RESULT:** The sidebar header reads "OFFICE TOOLS" instead of "OFFICE PORTAL", matching the screenshot reference. No logic, layout, or routing changes.

### Changes

| File | Line | Before | After |
|------|------|--------|-------|
| `OfficeSidebar.tsx` | 62 | `Office Portal` | `Office Tools` |

That is the only place this label appears in the sidebar. The mobile top bar in `OfficePortal.tsx` shows the active section name (e.g., "ai extract"), not "Office Portal", so no change is needed there. The page component filename (`OfficePortal.tsx`) and route path (`/office`) remain unchanged — renaming files is unnecessary cosmetic churn.

