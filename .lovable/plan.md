
# Screenshot Feedback Tool -- Global "Report a Change" Button

## Overview

Add a floating "Screenshot Feedback" button available on every page. When tapped, it captures the current screen, lets the user annotate it (draw/circle with a pen), type what change they need, and sends it as a task to **sattar@rebar.shop** and **radin@rebar.shop** inboxes.

## How It Works

1. User clicks a small camera/bug icon (floating, near the Vizzy button)
2. The app captures the visible page using `html2canvas` (renders DOM to canvas)
3. A full-screen annotation overlay opens with:
   - The screenshot as background
   - Drawing tools (pen, circle) with color picker (red default)
   - An undo button and clear button
   - A text area: "Describe the change you need"
4. User annotates and types, then clicks "Send"
5. The annotated image is uploaded to `clearance-photos/feedback-screenshots/` storage bucket
6. Two tasks are created in the `tasks` table -- one assigned to sattar, one assigned to radin
7. Two notifications are inserted so they see it in their inbox
8. Toast confirms "Feedback sent!"

## Files to Create

### 1. `src/components/feedback/ScreenshotFeedbackButton.tsx`
- Floating button (camera icon), positioned above the Vizzy button area
- On click: dynamically imports `html2canvas`, captures `#main-content`, opens the annotation dialog
- Throttle: disable button for 3 seconds after capture to prevent spam

### 2. `src/components/feedback/AnnotationOverlay.tsx`
- Full-screen dialog with the screenshot as canvas background
- Drawing layer on top (reuses canvas pattern from existing `SignaturePad`)
- Tools: Pen (freehand), color toggle (red/blue/yellow), undo stroke, clear all
- Text input at bottom: "What change do you need?"
- Send button: uploads annotated canvas as PNG to storage, creates tasks + notifications
- Cancel button to discard
- Guards: cannot send without either annotation or description text

### 3. No new edge functions needed
- Uses direct Supabase client for storage upload, task insert, and notification insert

## Database Changes

### Add `attachment_url` column to `tasks` table
A nullable text column to hold the screenshot URL:
```sql
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachment_url text;
```

No other schema changes needed.

## Changes to Existing Files

### `src/components/layout/AppLayout.tsx`
- Import and render `<ScreenshotFeedbackButton />` alongside `FloatingVizzyButton`
- Single line addition, no other changes

### `package.json`
- Add `html2canvas` dependency for DOM-to-canvas capture

## Technical Details

- **Capture target**: `document.getElementById('main-content')` -- avoids capturing overlays/modals
- **Storage path**: `clearance-photos/feedback-screenshots/{companyId}/{timestamp}.png`
- **Task creation**: Two rows inserted into `tasks` table with `assigned_to` set to the profile IDs of sattar (`ee659c5c-20e1-4bf5-a01d-dedd886a4ad7`) and radin (`5d948a66-619b-4ee1-b5e3-063194db7171`)
- **Notifications**: Two rows in `notifications` with `link_to: '/tasks'`, `priority: 'high'`, and the screenshot URL in metadata
- **Throttle guard**: 3-second cooldown on the capture button to prevent duplicate captures
- **Safe serialization**: Canvas `toDataURL` exports as PNG blob before upload; no base64 in the database -- only the storage URL is saved
- **Drawing**: Canvas overlay with `globalCompositeOperation: 'source-over'`, red stroke default, 3px line width
- **Undo**: Stroke history array; each stroke is saved as an `ImageData` snapshot for fast undo
- **Mobile**: Touch events supported (same pattern as existing `SignaturePad`)
- **No domino effects**: Completely self-contained new components; no existing components modified except one import line in `AppLayout.tsx`
