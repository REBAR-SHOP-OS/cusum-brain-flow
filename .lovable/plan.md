## Bug

Clicking the 5-Stories icon → picking a date → picking a product creates the 5 cards on the **previous day** (e.g. picking Jun 1 inserts them on May 31). Because the calendar shows the current week starting Monday, the cards appear "missing" and their images appear "not displayed".

Verified in DB: every recent `content_type = 'story'` row has `scheduled_date = 2026-05-31`, even though they were generated today (Jun 1) and the user picked Jun 1+. Image URLs are populated correctly — the only defect is the date.

## Root cause

`src/hooks/useAutoGenerate.ts` → `buildScheduledDate(baseDate, hour, minute)`:

```ts
const d = new Date(baseDate);          // baseDate = "2026-06-01"
const year  = d.getFullYear();         // parsed as UTC midnight
const month = d.getMonth() + 1;        // → in EDT becomes 2026-05-31 20:00
const day   = d.getDate();             // → returns 2026 / 5 / 31  ❌
```

The Stories flow passes `scheduledDate: format(date, "yyyy-MM-dd")`. A bare `YYYY-MM-DD` string is parsed as UTC by the JS `Date` constructor, then `getFullYear/Month/Date` reads it in the browser's local timezone (Eastern), shifting it back one day.

The regular "auto-generate today" path passes `new Date().toISOString()` (a full timestamp with a current local time embedded), which usually keeps the same calendar date in Eastern time, so the bug is most visible on the Stories path.

## Fix (single file, surgical)

Edit `src/hooks/useAutoGenerate.ts`:

1. Make `buildScheduledDate` accept either a `YYYY-MM-DD` string or a full ISO timestamp.
2. When the input matches `/^\d{4}-\d{2}-\d{2}$/`, split the string and use the components directly (no `Date` parsing) — so "2026-06-01" stays Jun 1.
3. Otherwise fall back to the existing `new Date(baseDate)` path for full ISO strings.

Resulting builder (sketch):

```ts
function buildScheduledDate(baseDate: string, hour: number, minute: number): string {
  let year: number, month: number, day: number;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseDate);
  if (dateOnly) {
    year = +dateOnly[1]; month = +dateOnly[2]; day = +dateOnly[3];
  } else {
    const d = new Date(baseDate);
    year = d.getFullYear(); month = d.getMonth() + 1; day = d.getDate();
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");
  return new Date(`${year}-${mm}-${dd}T${hh}:${mi}:00-04:00`).toISOString();
}
```

No other files change. The edge function, the placeholder insert path, and the Stories popover stay as-is.

## Verification

1. Open Social Media Manager → click the pink 5-Stories icon → pick e.g. Jun 3 → pick "Rebar Cages".
2. Confirm 5 placeholder cards appear in the **Wed Jun 3** column (Eastern time slots 06:30 / 07:30 / 08:00 / 12:30 / 14:30).
3. After generation completes, confirm each card shows a 9:16 image (no caption).
4. DB check: `select scheduled_date from social_posts where content_type='story' order by created_at desc limit 5;` — all five rows should be `2026-06-03 ...`.

## Out of scope

- Cleaning up the already-misplaced May 31 story rows (can be done separately if the user wants).
- Any change to image generation, the edge function, the Stories prompt, or the popover UI — those are working.
