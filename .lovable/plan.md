

# Replace Export Button with Schedule-to-Social Popover

## Problem
The user wants the Export button in the video editor toolbar to instead open a date/time picker (calendar + time selector). When confirmed, the video should be scheduled as a social media post card in the Social Media Manager.

## Approach

Replace the Export button (line 1062-1070 in `ProVideoEditor.tsx`) with a Popover containing a Calendar and time selectors. On confirm, insert a record into `social_posts` with the video URL, scheduled date, and platform set to "instagram" (reel). This reuses the same insert pattern already in `AdDirectorContent.tsx` lines 81-92.

## Changes

### `src/components/ad-director/ProVideoEditor.tsx`

1. **Replace the Export button** with a Popover trigger button showing a `CalendarClock` icon and "Schedule" label
2. **Add Popover content** with:
   - `Calendar` component for date selection (disable past dates)
   - Hour/Minute `Select` dropdowns (same pattern as `SchedulePopover.tsx`)
   - Confirm button
3. **On confirm**: call `supabase.from("social_posts").insert(...)` with:
   - `platform: "instagram"`, `content_type: "reel"`
   - `image_url: finalVideoUrl` (the assembled video URL)
   - `scheduled_date`: selected datetime ISO string
   - `title`: brand name
   - `content`: from segments text
   - `status: "scheduled"`, `qa_status: "scheduled"`
4. **Remove** `onExport`, `exporting`, `onOpenExportDialog` props (no longer needed)
5. Show success toast with scheduled date/time

### `src/components/ad-director/AdDirectorContent.tsx`

- Remove `ExportDialog` import and rendering (lines 401-408)
- Remove `exportDialogOpen` state
- Remove `handleExport` function
- Remove `onOpenExportDialog` prop from `<ProVideoEditor>`
- Keep `onExport` as no-op or remove entirely

### `src/components/ad-director/ExportDialog.tsx`

- No deletion needed, but it will no longer be used from the editor flow

| File | Change |
|---|---|
| `ProVideoEditor.tsx` | Replace Export button with CalendarClock schedule popover, insert social_posts on confirm |
| `AdDirectorContent.tsx` | Remove ExportDialog, handleExport, and related props |

