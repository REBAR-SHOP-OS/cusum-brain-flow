

## Add a `/vizzy` Route for Siri Shortcut Access

### Goal
Create a dedicated `/vizzy` page at `www.erp.rebar.shop/vizzy` that automatically starts the Voice Vizzy session on load. This lets you create a Siri Shortcut that says "Hey Siri, open Vizzy" and lands you straight into a voice conversation.

### What will be built

1. **New page: `src/pages/VizzyPage.tsx`**
   - A full-screen, minimal page (no sidebar/topbar clutter)
   - Auto-starts the ElevenLabs voice session as soon as the page loads
   - Shows the same Jarvis-style overlay (brain icon, transcript, speaking indicator)
   - Includes a close/back button that navigates to `/home`
   - Protected route (requires login)
   - Still gated to `sattar@rebar.shop` only

2. **Route registration in `App.tsx`**
   - Add `/vizzy` as a protected route (without AppLayout wrapper so it's a clean full-screen experience)

3. **Siri Shortcut setup (manual, on your iPhone)**
   - Open the Shortcuts app
   - Create a new shortcut: "Open URL" with `https://erp.rebar.shop/vizzy`
   - Name it "Vizzy" -- then say "Hey Siri, Vizzy" to launch it

### Technical details

- The new `VizzyPage` component will reuse the same `useConversation` hook and ElevenLabs token flow from the existing `VoiceVizzy` component
- Auto-start will be triggered via a `useEffect` on mount (with a guard to prevent double-start)
- The page will be registered as a standalone protected route without the `AppLayout` wrapper:
  ```
  <Route path="/vizzy" element={<ProtectedRoute><VizzyPage /></ProtectedRoute>} />
  ```
- No changes to the existing `VoiceVizzy` component or edge function -- this is additive only

