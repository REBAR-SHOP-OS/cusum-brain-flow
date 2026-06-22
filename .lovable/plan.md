# Plan: Day-of-Year Occasions in Social Calendar Header

## Goal
Above each day column in the weekly Social Media calendar (Mon–Sun strip), show a small calendar icon and the name of any occasion/holiday that falls on that date (e.g. "Canada Day", "Father's Day"), so the user instantly knows what that day represents and can plan content accordingly. UI-only change.

## Scope
- File: `src/components/social/SocialCalendar.tsx` (day-header block at lines ~253–262)
- New file: `src/data/occasionCalendar.ts` — frontend mirror of the curated occasion list (Canadian + global marketing-relevant dates), already proven on the backend in `supabase/functions/_shared/eventCalendar.ts`.
- No backend, RLS, schema, or business-logic changes.

## UI Changes (per day column)
Header becomes a small stacked block:

```text
┌──────────────────────────┐
│ 🗓  Tue 23               │
│ • Make Music Day         │   ← only if occasion exists
└──────────────────────────┘
```

- Left-side `Calendar` icon from `lucide-react` (size 14, `text-muted-foreground`).
- Day label (`EEE d`) stays unchanged.
- If today: existing "Today" pill stays, plus a subtle `bg-muted` background.
- Occasion line: 11px, `text-primary/80`, single line, `truncate`, with tooltip showing the full name + theme on hover. Hidden entirely when there is no occasion (no empty space reserved → layout unchanged on empty days).

## Data
`src/data/occasionCalendar.ts` exports:
- `type Occasion = { month: number; day: number; name: string; theme?: string }`
- `OCCASIONS: Occasion[]` — Canadian/Ontario + global dates relevant to rebar.shop's audience (e.g. Jan 1 New Year, Feb 14 Valentine's, Mar 17 St. Patrick's, May Victoria Day, Jul 1 Canada Day, Sep Labour Day, Oct 31 Halloween, Nov 11 Remembrance Day, Dec 25 Christmas, plus construction-industry days like World Engineering Day Mar 4, Global Recycling Day Mar 18, Earth Day Apr 22, Father's Day, Mother's Day, etc.).
- `getOccasionFor(date: Date): Occasion | undefined` — month/day match, no year.

Static list, zero network, zero state. Easy to extend later.

## Validation
- Re-read edited file after change.
- Visual check on `/social-media-manager` for the current week: confirm icon appears on every day, occasion text appears only on dated occasions (e.g. Jun 21 Father's Day, Jul 1 Canada Day), and no occasion-less days reserve blank space.
- No regression test required (pure presentational, additive).

## Non-Goals
- No editing of occasion list from UI.
- No persistence, no per-company customization.
- No AI prompt wiring (backend `eventCalendar.ts` already handles that side).
