

# Add Visible Voice Chat Button to Floating Vizzy

## Problem
The voice chat feature is hidden behind a long-press gesture on the Vizzy button. There's no visible microphone icon, so users don't know it exists.

## Solution
Add a small **microphone icon button** that appears next to the Vizzy avatar when the user hovers or taps it. This gives users a clear, discoverable way to start voice chat.

## Design
- A small mic icon (using Lucide's `Mic` icon) will appear as a secondary button positioned just above or beside the main Vizzy avatar
- On **desktop**: the mic button appears on hover over the Vizzy area
- On **mobile**: the mic button is always visible (since hover doesn't work on touch)
- Tapping the mic button navigates to `/chat?voice=1`
- Tapping the main avatar still navigates to `/chat` (text mode)
- This eliminates the need for the long-press gesture entirely

## Technical Changes

### File: `src/components/vizzy/FloatingVizzyButton.tsx`
1. Import `Mic` icon from `lucide-react`
2. Add a `showActions` state that toggles on hover (desktop) or is always true (mobile)
3. Render a small mic button above the main avatar circle
4. Simplify the pointer-up handler: remove long-press logic, tap always goes to `/chat`
5. Mic button click navigates to `/chat?voice=1`
6. Update tooltip text to just "Tap to chat" since voice now has its own button

### Visual Layout
```text
       [Mic]       <-- small circular mic button (28px)
   [Vizzy Avatar]  <-- main button (56px)
```

The mic button will have matching styling (teal ring, slight shadow) to look cohesive with the main avatar.

