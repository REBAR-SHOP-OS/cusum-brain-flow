

# Fix: Voice Button Hidden Behind Mobile Nav Bar

## Problem

On mobile, when you open the JARVIS chat (`/chat`), the bottom navigation bar (Home, Inbox, Tasks, Floor) overlaps the chat input toolbar area. This hides the mic button, emoji picker, formatting tools, and the send button row.

The LiveChat page uses `h-screen` for its own full-screen layout, but the `MobileNavV2` component sits on top of it at `fixed bottom-0 z-40 h-14`.

## Solution

Hide the mobile bottom nav bar when the user is on the `/chat` route. The chat page already has its own back button for navigation, so the bottom nav is redundant there.

## Technical Changes

### File: `src/components/layout/MobileNavV2.tsx`

- Add a check for `location.pathname === "/chat"`
- Return `null` (render nothing) when on the chat route
- This is a 2-line change at the top of the render logic

### File: `src/pages/LiveChat.tsx`

- Remove the `pb-14` bottom padding that AppLayout's main content area adds (or rather, since LiveChat uses its own `h-screen`, ensure the input area is not clipped)
- No changes may be needed here if hiding the nav is sufficient

### File: `src/components/layout/AppLayout.tsx` (optional)

- The main content area has `pb-14 md:pb-0` for mobile nav spacing
- On `/chat`, since nav is hidden, this extra padding is unnecessary but harmless

## No backend changes needed

Single file edit (MobileNavV2.tsx) to hide the nav on the chat route.

