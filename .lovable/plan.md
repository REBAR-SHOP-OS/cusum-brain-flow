

# Convert Per-User Report to Plain Text English Format

## Problem
The per-user report dialog currently shows data in a grid of metric cards (Status, Hours, Activities, etc.). The user wants a **plain English text report** showing clock in/out times and a comprehensive daily summary — not card-based UI widgets.

## Change

### File: `src/components/vizzy/SectionDetailReport.tsx` — `OverviewReport` component (lines 403-444)

Replace the card grid UI with a formatted text report rendered as a `<pre>` / monospace block:

**New report format:**
```text
══════════════════════════════════════════
  DAILY REPORT — {userName}
  {date}
══════════════════════════════════════════

ATTENDANCE
  Status:     Clocked In / Off Clock
  Gross Hours: 5.1h
  Clock Entries:
    • 07:42 AM → 12:50 PM (5.1h)
    • 01:15 PM → ongoing

──────────────────────────────────────────

PERFORMANCE SUMMARY
  Activities:   12
  AI Sessions:  3
  Emails Sent:  5

──────────────────────────────────────────

ACTIVITY BREAKDOWN
  Visited page ........... 6
  Sent email ............. 5
  AI interaction ......... 3

══════════════════════════════════════════
```

**Implementation details:**
- Replace the `return (...)` JSX block (lines 403-444) with a single `<pre>` element styled with `whitespace-pre-wrap`, `font-mono`, and proper padding
- Build the report string from the same data already fetched (`perf`, `report`)
- Include clock entry durations (calculate from clock_in/clock_out)
- Keep the "Copy Report" button at the top
- Update the `buildReportLines()` function to match the same format
- Update the `vizzy_memory` save (lines 324-366) to use the same comprehensive text

| File | Change |
|------|--------|
| `SectionDetailReport.tsx` | Replace OverviewReport card grid with plain text English report |

