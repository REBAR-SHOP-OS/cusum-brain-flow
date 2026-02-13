

# Open Live Chat as Full-Screen Page

## Problem
The Live Chat currently opens as a small floating panel (340px wide, 500px max height) in the bottom-right corner. The user wants it to open as a full, big-screen experience instead.

## Solution

When the floating agent button is clicked, navigate to a dedicated `/chat` route that shows the chat interface full-screen, instead of toggling the small widget overlay.

### Changes

#### 1. New Page: `src/pages/LiveChat.tsx`
- Full-screen chat page reusing the existing `useAdminChat` hook
- Same features as the widget (send, stream, clear, cancel, markdown rendering) but laid out across the full viewport
- Back button in the header to return to the previous page
- Agent avatar and name in the header (personalized per user like the floating button)

#### 2. `src/components/vizzy/FloatingVizzyButton.tsx`
- Change `handleClick` from dispatching `toggle-live-chat` event to navigating to `/chat` using `useNavigate()`

#### 3. `src/App.tsx`
- Add the `/chat` route pointing to the new `LiveChat` page

#### 4. `src/components/layout/LiveChatWidget.tsx`
- No changes needed initially -- it can remain for backward compatibility, but the floating button will no longer trigger it

## Technical Summary

| File | Change |
|------|--------|
| `src/pages/LiveChat.tsx` | New full-screen chat page using `useAdminChat` |
| `src/components/vizzy/FloatingVizzyButton.tsx` | Navigate to `/chat` instead of toggling widget |
| `src/App.tsx` | Register `/chat` route |

