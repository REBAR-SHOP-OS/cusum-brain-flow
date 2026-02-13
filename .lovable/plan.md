

# Team Hub -- Full Audit and Improvement Plan

## Current State

The Team Hub is a real-time messaging system with channels, DMs, auto-translation, video meetings (Jitsi/RingCentral), live transcription (Web Speech API), AI meeting notes, and post-meeting summarization. It covers 8 components, 5 hooks, and 3 edge functions.

---

## Issues Found

### 1. Bugs / Functional Problems

**A. Non-functional buttons (UI-only placeholders)**
Several buttons in the MessageThread header and composer do nothing:
- **Phone** (audio call) button -- no onClick handler
- **Users** (member list) button -- no onClick handler  
- **Pin** (pinned messages) button -- no onClick handler
- **Search in channel** button -- no onClick handler
- **Formatting buttons** (Bold, Italic, List, Code, @mention) -- no handlers
- **Paperclip** (file attach) button -- no handler
- **Emoji** (Smile) button -- no handler

**Fix:** Remove non-functional buttons to avoid confusing users. Keep only buttons that work: Video (start meeting), Send, and the translation toggle. Add them back when functionality is implemented.

**B. DMs section toggle is broken**
In `ChannelSidebar.tsx` line 229, the DM section header has `onClick={() => {}}` -- an empty handler. It should toggle collapse/expand like the Channels section does.

**Fix:** Add a `dmsOpen` state and wire it to toggle.

**C. Sidebar hover behavior is fragile on desktop**
The sidebar auto-collapses to 14px (w-14) when mouse leaves and expands on hover. This creates a poor experience: accidental mouse movements collapse the sidebar, search input disappears, and the sidebar content flickers. The user's screenshot shows the Team Hub button from the Home page, suggesting they navigate there often.

**Fix:** Remove the auto-collapse hover behavior. Keep the sidebar always expanded on desktop (w-64), and use the Sheet for mobile only.

**D. `channelsLoading` state is fetched but never used**
In TeamHub.tsx, `channelsLoading` is destructured but never shown to the user. If channels are loading, the page just shows the empty "Welcome" state.

**Fix:** Show a loading skeleton when channels are loading.

### 2. Performance Issues

**E. Translation request for every message to all languages**
Currently, `useSendMessage` translates every message into every active team member's language. With 10 team members speaking 5 languages, this means every message triggers an AI call. The `targetLangs` are computed from ALL active profiles, not just channel members.

**Fix:** Only translate to languages of members in the current channel, not all company profiles. This requires fetching channel member languages.

**F. No message pagination**
Messages are fetched with `.limit(200)`. Channels with heavy traffic will hit this cap and older messages become inaccessible.

**Fix:** Add scroll-to-top pagination (load older messages when scrolling up).

### 3. UX Improvements

**G. No unread message indicators**
There is no tracking of which messages a user has read. All channels look the same in the sidebar regardless of new messages.

**Fix:** Add a `last_read_at` tracking per user per channel, and show unread counts in the sidebar.

**H. No typing indicators**
No feedback when another user is typing.

**Fix:** Use Supabase Realtime presence to broadcast typing state.

**I. Meeting recording storage bucket may not exist**
The `useMeetingRecorder` uploads to `meeting-recordings` bucket, but there's no migration creating this storage bucket.

**Fix:** Verify the bucket exists; if not, create it via migration.

### 4. Security

**J. Channel creation policy is too permissive for DMs**
The INSERT policy on `team_channels` requires `admin` or `workshop` role. But `useOpenDM` creates DM channels, meaning non-admin/non-workshop users (e.g., sales, accounting) cannot create DMs. This is likely a bug.

**Fix:** Allow all authenticated users to create DM-type channels, or use a database function.

**K. Linter warning: permissive RLS policy**
One `USING(true)` or `WITH CHECK(true)` policy exists on non-Team Hub tables (migration_logs, penny_collection_queue, etc.). Not Team Hub related but noted.

---

## Recommended Implementation (Priority Order)

### Phase 1: Fix broken UI (immediate)

| Task | Details |
|------|---------|
| Remove non-functional buttons | Strip placeholder Bold/Italic/List/Code/Attach/Emoji/@mention/Phone/Pin/Search buttons from MessageThread |
| Fix DM section toggle | Add `dmsOpen` state to ChannelSidebar |
| Remove sidebar auto-collapse | Always show expanded sidebar on desktop |
| Show channel loading state | Use `channelsLoading` to display skeleton |

### Phase 2: Core improvements

| Task | Details |
|------|---------|
| Add unread indicators | New `team_channel_reads` table tracking `last_read_at` per user per channel. Show badge counts in sidebar. |
| Optimize translations | Only translate to languages of current channel members, not all company members |
| Add typing indicators | Use Supabase Realtime presence for typing state |

### Phase 3: Future enhancements (out of scope for now)

- Message pagination (load older on scroll)
- File attachments
- Message reactions (emoji)
- Message threading (replies)
- Channel search

---

## Technical Details

### Files to modify:
- `src/components/teamhub/MessageThread.tsx` -- Remove 12+ placeholder buttons, clean up composer
- `src/components/teamhub/ChannelSidebar.tsx` -- Fix DM toggle, remove hover collapse, add unread badges
- `src/pages/TeamHub.tsx` -- Use `channelsLoading`, optimize `targetLangs`
- `src/hooks/useTeamChat.ts` -- Add unread count query, typing presence

### Database changes (Phase 2):
- New table `team_channel_reads` (channel_id, profile_id, last_read_at) with RLS
- Query for unread counts: messages created_at > last_read_at per channel

### No edge function changes needed for Phase 1.

