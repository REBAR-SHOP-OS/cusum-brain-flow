

# Enhance Per-Employee Report Button with Comprehensive Report

## Goal
When the clipboard icon next to each employee in the Team Daily Report is clicked, it should generate and copy a detailed, comprehensive English text report covering all of that employee's daily performance data — not just a simple activity list.

## Change

### `src/components/vizzy/VizzyBrainPanel.tsx` (lines 645-660)
Update the `getText` function in the per-employee `SectionReportButton` to produce a full structured report including:

1. **Header** — Employee name, date, total activity count
2. **Time Clock Summary** — All clock-in/out entries with durations, total hours worked
3. **Activity Breakdown by Category** — Group activities by `entity_type` (e.g., Dashboard: 12, Inbox: 8, Orders: 5) with counts
4. **Activity Timeline** — Chronological list of all activities with timestamps, event types, and descriptions
5. **Summary Stats** — First activity time, last activity time, total active span

The report format will be clean English text, structured with sections and bullet points, ready for pasting into any document or chat.

### Example Output
```text
📋 DAILY PERFORMANCE REPORT — Sattar Mohammadi
Date: April 7, 2026 | Total Activities: 137

⏰ TIME CLOCK
• Clocked in: 8:15 AM → Still working
• Total hours: 5h 35m

📊 ACTIVITY BREAKDOWN
• Dashboard: 37 events
• Inbox: 25 events
• Orders: 20 events
• Team Hub: 15 events
...

📝 ACTIVITY LOG (137 events)
• 1:48 PM — page_view · Dashboard: Viewed dashboard
• 1:45 PM — mutation · Orders: Updated order #1234
...
```

## Impact
- Single file changed (`VizzyBrainPanel.tsx`)
- Only the `getText` callback is updated — no structural or logic changes
- Calculates clock durations and groups activities by entity type inline

