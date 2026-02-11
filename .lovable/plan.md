

## Unify Voice Vizzy Into One

### Problem
There are two separate Voice Vizzy implementations with duplicated code:
1. `VoiceVizzy` component -- floating mic button rendered in `AppLayout`, has its own ElevenLabs session, transcript, reconnect logic
2. `VizzyPage` at `/vizzy` -- full-screen voice page for Siri shortcuts, has its own separate ElevenLabs session, transcript, reconnect logic

Both do the same thing but feel like two different assistants.

### Solution
Remove the duplicate `VoiceVizzy` component from `AppLayout` and keep only the `VizzyPage` as the single voice experience. The floating mic button will navigate to `/vizzy` instead of spinning up a separate voice session.

### Changes

**1. `src/components/layout/AppLayout.tsx`**
- Remove the `VoiceVizzy` import and component
- Add a simple floating mic button (for `sattar@rebar.shop` only) that navigates to `/vizzy`

**2. `src/components/vizzy/VoiceVizzy.tsx`**
- Delete this file entirely (its logic is already duplicated in `VizzyPage.tsx`)

**3. `src/pages/VizzyPage.tsx`**
- Already has all features (mute, volume, camera, reconnect, quotation cards, context loading, transcript persistence)
- No changes needed -- this becomes the single voice Vizzy

### Result
- One Voice Vizzy, one codebase, one experience
- Floating mic button just opens `/vizzy`
- Siri Shortcut still works via `/vizzy`
- Text-chat Vizzy at `/agent/assistant` remains as the text interface
- Both share the same "Vizzy" identity

