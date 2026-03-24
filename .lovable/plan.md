

## Show Enlarged Profile Photo on Avatar Click

### Problem
When clicking a team member's avatar in the sidebar, nothing visual happens for their profile photo. The user wants the avatar to enlarge (lightbox-style preview).

### Change

**File**: `src/components/teamhub/ChannelSidebar.tsx`

1. Add state: `previewProfile: Profile | null`
2. On the avatar `<div className="relative">` (line 217), add an `onClick` handler with `e.stopPropagation()` that sets `previewProfile` to the clicked member — this prevents the DM click from firing
3. Render a simple Dialog/overlay at the bottom of the component that shows:
   - Large avatar (w-40 h-40) with the user's photo or initials
   - User's name below the avatar
   - Click outside or X to close

The existing row `onClick` (line 214) still opens the DM. Only clicking the small avatar circle opens the preview.

| File | Change |
|---|---|
| `src/components/teamhub/ChannelSidebar.tsx` | Add avatar preview dialog with enlarged photo on avatar click |

