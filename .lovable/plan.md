

# Comprehensive Team Report — Full Report Icon & Vizzy Access

## What This Does

When the clipboard icon in the Team Daily Report header is clicked, it will open a full-page modal showing a **comprehensive report of ALL users** with their activities, hours, AI sessions, emails, and clock entries — not just one user. The report text will also be saved to the database so Vizzy always has access to it.

## Changes

### 1. New `TeamFullReport` component in `SectionDetailReport.tsx`

Replace the current `sectionType="team"` rendering (which just shows `ActivityReport` for one user) with a new `TeamFullReport` component that:

- Accepts all profiles and the `useTeamDailyActivity` data
- Displays a summary section: total team activities, total hours, total emails, total AI sessions
- Per-user breakdown: each user gets a card with their activity count, hours, AI sessions, emails, clock-in/out times, and top activity types
- "Copy Report" button generates a structured plain-text version of the full team report
- **Auto-saves** the report text to `vizzy_memory` table (category: `team_daily_report`) so Vizzy can always reference it

### 2. Update `SectionDetailReportDialog` for `sectionType="team"`

- Pass additional props: `profiles` (all team profiles) and `teamData` (from `useTeamDailyActivity`)
- When `sectionType === "team"`, render the new `TeamFullReport` instead of `ActivityReport`

### 3. Update `VizzyBrainPanel.tsx` — TeamDailyReport header icon

- Pass `profiles` and `data` (team activity data) into the `SectionDetailReportDialog` with `sectionType="team"`
- Remove the incorrect `profileId={sorted[0]?.id}` / `userId={sorted[0]?.user_id}` which made it show only one user

### 4. Save report to `vizzy_memory` for Vizzy access

- When the team report modal opens, auto-generate a structured text summary and upsert it into `vizzy_memory` with:
  - `category: "team_daily_report"`
  - `content`: the full structured text of all users' activities and performance
  - This ensures Vizzy (via `buildFullVizzyContext` which already queries `vizzy_memory`) always has access to the latest team report

## Report Content (per user)

```text
── Team Daily Report — Apr 8, 2026 ──

TEAM SUMMARY
Total Activities: 509 | Total Hours: 42.3h | Emails: 15 | AI Sessions: 8

── Zahra (109 activities) ──
Hours: 7.2h | AI: 3 | Emails: 5
Clock: 8:02 AM → Still working
Top: page_visit (45), email_sent (22), lead_updated (15)

── Neel (83 activities) ──
Hours: 6.5h | AI: 2 | Emails: 3
Clock: 8:15 AM → 5:30 PM
Top: page_visit (30), order_updated (18)
...
```

| File | Change |
|------|--------|
| `SectionDetailReport.tsx` | Add `TeamFullReport` component; update dialog to accept team data for `sectionType="team"` |
| `VizzyBrainPanel.tsx` | Pass all profiles + team data to the team report dialog |

No database migration needed — `vizzy_memory` table already exists and is already queried by Vizzy's context builder.

