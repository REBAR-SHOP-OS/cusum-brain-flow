

# Add Centralized Timezone & Date Format Settings (Toronto, Canada)

## Problem
Timezone is hardcoded across ~7+ files as `"America/New_York"` or `"America/Toronto"`. No user-facing setting exists. Vizzy and other systems have no single source of truth for the business timezone.

## Approach

### 1. Create `workspace_settings` table
Single-row table storing company-wide settings:
- `timezone` (text, default `'America/Toronto'`)
- `date_format` (text, default `'MM/dd/yyyy'`)
- `time_format` (text, default `'12h'` — 12-hour or 24-hour)

Migration SQL:
```sql
CREATE TABLE public.workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone text NOT NULL DEFAULT 'America/Toronto',
  date_format text NOT NULL DEFAULT 'MM/dd/yyyy',
  time_format text NOT NULL DEFAULT '12h',
  company_id text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read" ON public.workspace_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update" ON public.workspace_settings FOR UPDATE TO authenticated USING (true);
INSERT INTO public.workspace_settings (timezone, date_format, time_format) VALUES ('America/Toronto', 'MM/dd/yyyy', '12h');
```

### 2. Create `useWorkspaceSettings` hook
- Fetches the single row from `workspace_settings`
- Caches with React Query (long stale time — rarely changes)
- Exports `timezone`, `dateFormat`, `timeFormat` values
- Provides `updateSettings` mutation

### 3. Create `src/lib/dateConfig.ts` utility
- `getTimezone()` — returns stored timezone (with `'America/Toronto'` fallback)
- `formatAppDate(date)` — formats using the workspace date format
- `formatAppTime(date)` — formats using the workspace time format
- `toZonedNow()` — returns current time in the workspace timezone

### 4. Add "Date & Time" section to Settings page
Between the Language and Appearance sections in `src/pages/Settings.tsx`:
- **Timezone** dropdown — common North American timezones (Toronto, New York, Chicago, Denver, Los Angeles, Vancouver)
- **Date format** dropdown — `MM/dd/yyyy`, `dd/MM/yyyy`, `yyyy-MM-dd`
- **Time format** toggle — 12-hour / 24-hour
- Save button updates `workspace_settings`

### 5. Update key consumers (additive, non-breaking)
Replace hardcoded timezone strings with the shared utility in these files:
- `src/lib/shiftUtils.ts` — use configured timezone instead of local time
- `src/hooks/useTimeClock.ts` — replace `"America/New_York"` literal
- `supabase/functions/_shared/vizzyFullContext.ts` — read from settings or use default
- `supabase/functions/comms-alerts/index.ts` — replace `"America/Toronto"` literal

Edge functions that cannot easily query the DB will continue using `"America/Toronto"` as the hardcoded default (same value, just now documented as the canonical default).

### Files changed
| File | Action |
|------|--------|
| Migration SQL | Create `workspace_settings` table + seed row |
| `src/hooks/useWorkspaceSettings.ts` | New hook |
| `src/lib/dateConfig.ts` | New utility |
| `src/pages/Settings.tsx` | Add Date & Time section |
| `src/lib/shiftUtils.ts` | Use timezone from config |
| `src/hooks/useTimeClock.ts` | Use timezone from config |

### Safety
- All changes are additive
- Hardcoded defaults match current behavior (`America/Toronto`)
- No existing flows break if the table query fails — fallback is always `America/Toronto`
- Edge functions keep their hardcoded defaults (cannot query client-side settings at runtime)

