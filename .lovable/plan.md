

# Remove Voice Chat and All Related Files

## Summary

Remove the Vizzy voice chat feature entirely, including the page, the ElevenLabs connection token edge function, and all navigation references to `/vizzy`. The floating button and text chat remain intact but will no longer offer voice chat.

## Files to Delete

1. **`src/pages/VizzyPage.tsx`** -- The entire voice chat page
2. **`supabase/functions/elevenlabs-conversation-token/index.ts`** -- Edge function for voice tokens (no longer needed)

## Files to Modify

### `src/App.tsx`
- Remove the `VizzyPage` import
- Remove the `/vizzy` route

### `src/components/vizzy/FloatingVizzyButton.tsx`
- Remove the long-press-to-voice logic
- Long press now does the same as short tap (opens `/chat`)
- Remove `LONG_PRESS_MS`, `longPressTimer`, `isLongPress` refs
- Update tooltip text from "Tap for text - Hold for voice" to just the agent name or remove tooltip

### `src/components/layout/AppLayout.tsx`
- No changes needed (FloatingVizzyButton stays, just no longer navigates to `/vizzy`)

### `src/pages/Home.tsx`
- Change `handleLiveChatClick` to navigate to `/chat` instead of `/vizzy`

### `src/pages/LiveChat.tsx`
- Remove the button/icon that navigates to `/vizzy` (the mic button in the toolbar)

### `src/pages/AgentWorkspace.tsx`
- Change `onLiveChatClick` from navigating to `/vizzy` to `/chat`

### `supabase/functions/_shared/pageMap.ts`
- Remove the `/vizzy` entry from the page map

## Files NOT Changed (kept as-is)

These files reference "Vizzy" as a brand name for the AI assistant (text chat), not voice chat specifically. They stay untouched:

- `src/lib/vizzyContext.ts` -- Used by text chat (`admin-chat` edge function)
- `src/lib/vizzyAutoReport.ts` -- Error reporting utility
- `src/types/vizzy.ts` -- Type definitions used by context
- `src/components/vizzy/VizzyDailyBriefing.tsx` -- Daily briefing widget
- `src/components/vizzy/VizzyPhotoButton.tsx` -- Photo analysis in chat
- `src/components/teamhub/VizzyMeetingPanel.tsx` -- Meeting AI panel
- `src/hooks/useMeetingAiBridge.ts` -- Meeting bridge hook
- `src/hooks/useGlobalErrorHandler.ts` -- Uses reportToVizzy
- `src/components/error/SmartErrorBoundary.tsx` -- Uses reportToVizzy
- `src/components/accounting/AccountingAudit.tsx` -- Uses reportToVizzy
- `src/hooks/useQuickBooksData.ts` -- Uses reportToVizzy
- `src/hooks/useFixRequestMonitor.ts` -- Fix request polling
- `src/components/ceo/FixRequestQueue.tsx` -- Fix request UI
- Edge functions: `vizzy-context`, `vizzy-briefing`, `vizzy-daily-brief`, `vizzy-erp-action`, `vizzy-photo-analyze` -- All used by text chat

## Edge Function Cleanup

The `elevenlabs-conversation-token` edge function will be deleted from deployment after the code files are removed.
