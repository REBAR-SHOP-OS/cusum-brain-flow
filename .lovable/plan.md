

# Add Schedule-to-Social-Calendar Button in Ad Director

## What
Add a calendar icon button next to Download/Edit Video in the Ad Director final preview. Clicking it opens a date+time picker popover, and on confirm creates a new social media post card with the video URL and scheduled date/time.

## Changes

### `src/components/ad-director/AdDirectorContent.tsx`

1. **Add state**: `scheduleOpen`, `scheduleDate`, `scheduleHour`, `scheduleMinute`
2. **Add calendar button** next to Download and Edit Video (line ~459), wrapped in a `Popover` with:
   - Calendar date picker
   - Hour/minute selectors (same pattern as `SchedulePopover`)
   - Confirm button
3. **On confirm**: Insert a new row into `social_posts` table with:
   - `platform: "instagram"` (default)
   - `status: "scheduled"`
   - `qa_status: "scheduled"`
   - `content_type: "reel"`
   - `image_url`: the `finalVideoUrl` (permanent storage URL)
   - `scheduled_date`: selected date+time ISO string
   - `title`: brand name or prompt text
   - `content`: prompt used for generation
   - `user_id`: current authenticated user
4. **Toast** success with link indication, or error on failure
5. **Import** `CalendarDays` icon, `Popover`, `Calendar`, `Select` components

| File | Change |
|---|---|
| `AdDirectorContent.tsx` | Add schedule popover button with date/time picker, insert social_posts row on confirm |

