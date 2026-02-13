

# Odoo Migration Status Panel for CEO Portal

## Overview
A monitoring-only card component that polls the database every 60 seconds, displays file migration progress, and shows a "Safe to Shutdown" badge when complete.

## New File
**`src/components/admin/OdooMigrationStatusCard.tsx`**
- Uses `@tanstack/react-query` with `refetchInterval: 60000` to poll
- Queries `lead_files` table using two filtered counts (via two separate `.select` calls with filters, since Supabase JS doesn't support `FILTER(WHERE...)` aggregates directly -- will use an RPC or two count queries)
- Displays: migrated count, remaining count, percentage, progress bar, estimated time remaining
- Shows a green Badge "Safe to Shutdown Odoo" when remaining reaches 0
- Uses existing Card, Progress, and Badge components

## Query Strategy
Since the Supabase JS client cannot do `COUNT(*) FILTER(WHERE ...)` in a single call, the component will run two parallel count queries:
1. `supabase.from('lead_files').select('*', { count: 'exact', head: true }).not('odoo_id', 'is', null).is('storage_path', null)` -- remaining
2. `supabase.from('lead_files').select('*', { count: 'exact', head: true }).not('odoo_id', 'is', null).not('storage_path', 'is', null)` -- migrated

## ETA Calculation
- Store the last 5 "remaining" values in a `useRef` array
- On each poll, push the new remaining count
- Calculate average delta per minute from the differences
- `ETA minutes = remaining / avg_delta_per_minute`

## CEO Portal Change
**`src/pages/CEOPortal.tsx`** -- add the component under a "System Status" heading, placed after the existing dashboard content.

## Visual Design
- Card with a "File Migration" title and a small database icon
- Progress bar showing percentage
- Stats row: migrated / total, remaining, ETA
- Green badge when complete, amber "In Progress" badge otherwise
- Minimal, consistent with existing card styling

## Technical Notes
- No database migrations needed (read-only queries on existing `lead_files` table)
- No edge functions touched
- No financial data accessed
- Temporary component -- will be removed after Odoo shutdown is confirmed
