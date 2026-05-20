## Goal
Add a row of **5 shortcut tiles** at the very top of every department dashboard (CEO, GM, Sales, Marketing, Estimation, Shop Floor, Accounting, R&D) on `/dashboard/v2`. Each tile = icon + label, clicks navigate to the most-used app/section for that department.

## Default shortcuts per department
| Dashboard | Shortcuts |
|---|---|
| **CEO** | CEO Portal · Pipeline · Accounting · Shop Floor · Vizzy |
| **GM** | Shop Floor · Pipeline · Accounting · Team Hub · Tasks |
| **Sales** | Sales Hub · Pipeline · Quotations · Customers · Lead Scoring |
| **Marketing** | Social Media Manager · Ad Director · Video Studio · Email Marketing · SEO |
| **Estimation** | Estimation · Quotations · Customers · Office Portal · Tasks |
| **Shop Floor** | Shop Floor · Cutter · Station · Clearance · Delivery Ops |
| **Accounting** | Accounting · Accounting Health · Invoices · Customers · Integrations |
| **R&D** | App Builder · Architecture · Brain · Automations · Admin Panel |

## Implementation
1. **`DashboardShell.tsx`** — add optional `shortcuts?: ReactNode` prop, rendered as a horizontal strip immediately below the header (above the status strip), shown only when provided. Use the existing `v2-panel` / `v2-border` tokens to stay on-theme; honor density (compact/comfortable) for padding.
2. **New `Shortcuts.tsx`** in `src/components/dashboards/v2/` — exports:
   - `ShortcutTile({ icon, label, to })` — small card with lucide icon + label, navigates via `react-router-dom`'s `Link`.
   - `ShortcutBar({ items })` — 5-column grid (responsive: 2 cols mobile, 5 cols ≥sm).
3. **Each `*DashboardV2.tsx`** — import the bar, define a `const shortcuts = [...]` array with lucide icons + routes from the table above, pass via `shortcuts={<ShortcutBar items={shortcuts} />}`.

No backend/data changes. No layout shift to existing sections. Adds the bar above; everything else unchanged.

## Out of scope
- Per-user customization of shortcuts (can be added later via the existing dashboard `prefs` localStorage if you want).
- Permissions filtering (links just render; existing route guards handle access).

## Confirm before I build
- Are the default shortcut sets above good, or do you want to swap any? (e.g. replace "Vizzy" on CEO with "Live Monitor", etc.)
