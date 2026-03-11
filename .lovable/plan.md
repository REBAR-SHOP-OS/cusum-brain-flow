

## Remove Page Names & Add Scheduled Time to Calendar Cards

### Changes in `src/components/social/SocialCalendar.tsx`

1. **Remove page names list** (lines 199-208) — delete the IIFE that renders `· page_name` entries
2. **Add scheduled time** — extract time from `firstPost.scheduled_date` using `format(parseISO(...), "h:mm a")` and display it as small muted text next to or below the status

### Result
```text
┌─────────────────────┐
│ [FB] ×6             │
│ True structural int…│
│ 6:30 AM · Scheduled │
└─────────────────────┘
```

