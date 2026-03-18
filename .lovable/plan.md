

## Plan: Add `/vizzy` Route for Dedicated Vizzy Live Voice Chat

### What exists now
- `/chat` — text-based LiveChat page (also has a mic button that opens `VizzyVoiceChat` as a full-screen overlay)
- `VizzyVoiceChat` component — full-screen GPT Realtime voice session with Vizzy
- `FloatingVizzyButton` — draggable button that also opens VizzyVoiceChat overlay
- No `/vizzy` route exists

### What to build
A new `/vizzy` page that opens directly into the full-screen Vizzy voice chat experience — no text chat, just the immersive voice interface. Navigating to `/vizzy` immediately starts a live GPT Realtime session.

### Changes

**1. Create `src/pages/VizzyLive.tsx`**
- Simple page wrapper that renders `VizzyVoiceChat` full-screen
- `onClose` navigates back (or to `/home`)
- Restricted to super admins (redirect if not authorized)

**2. Update `src/App.tsx`**
- Add route: `<Route path="/vizzy" element={<VizzyLive />} />`
- Import the new page component

**3. Update `src/hooks/useActiveModule.ts`**
- Add `/vizzy` entry: `{ module: "Vizzy", moduleRoute: "/vizzy" }`

That's it — three small file changes. The existing `VizzyVoiceChat` component and `useVizzyVoiceEngine` hook handle all voice logic already.

