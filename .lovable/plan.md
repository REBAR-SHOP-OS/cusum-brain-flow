

# Fresh Vizzy Voice Chat — Complete Rewrite (Multilingual)

## What's Changing

The entire `VizzyPage.tsx` (823 lines) will be deleted and replaced with a clean ~280-line voice chat page. The new page is built from scratch with:

- **Multilingual support**: Farsi and English are mandatory, plus the user's preferred language from their profile
- **Simple WebSocket-only connection**: No WebRTC, no fallback logic, no auto-reconnection loops
- **Manual retry only**: If disconnected, user taps "Reconnect" — no exponential backoff machinery
- **No WebPhone/RingCentral**: Removed from voice page (still available in text chat)
- **No quotation cards**: Removed from voice page (still available in text chat)
- **No silent mode**: Removed entirely
- **No VIZZY-ACTION parsing**: Removed from voice page

## Multilingual Design

The system prompt sent to the ElevenLabs agent will include:

```
LANGUAGE RULES:
- You are fluent in ALL languages, but especially English and Farsi (Persian).
- Detect the language the CEO speaks in and ALWAYS respond in that SAME language.
- If the CEO speaks Farsi, respond entirely in Farsi.
- If the CEO speaks English, respond entirely in English.
- If the CEO switches language mid-conversation, follow their switch immediately.
- You can handle mixed-language input (code-switching) naturally.
- Default language on session start: [from user profile, e.g. "en" or "fa"]
```

The context prompt and business data labels remain in English (since they're system-internal), but Vizzy's spoken responses will match whatever language the user speaks.

## Files Changed

### 1. `src/pages/VizzyPage.tsx` — Complete Rewrite (~280 lines)

Delete all 823 lines. New structure:

- **State**: `status` (idle | connecting | connected | error), `muted`, `volume`, `transcript[]`, `elapsed`
- **On mount**: Check admin role, request mic, fetch token, connect via WebSocket (`signed_url`)
- **Context**: Load snapshot from `vizzy-context` edge function, build context string with multilingual instructions, push via `sendContextualUpdate`
- **Transcript**: Simple list of `{role, text, id}` — no quotation type, no action parsing
- **On disconnect**: Save transcript, show "Reconnect" button
- **On error**: Show error + "Reconnect" button
- **UI**: Full-screen dark overlay, brain avatar with pulse, status label, transcript panel, mute/volume/close controls

Removed entirely:
- `useWebPhone` hook usage
- `QuotationDraft` interface and card UI
- `silentMode` / `silentModeRef` / `silentIntervalRef`
- `VIZZY-ACTION` tag parsing
- `autoFallbackAttemptedRef`, `useWebSocketFallbackRef`, `cachedSignedUrlRef`
- `buildConversationMemory` (reconnect memory injection)
- Auto-reconnection with exponential backoff
- `webPhoneInitRef` and all RingCentral client tools
- Periodic auto-save interval

### 2. `src/lib/vizzyContext.ts` — Add Multilingual Instructions

Add a `language` parameter to `buildVizzyContext(snap, language?)` that injects the multilingual language rules into the system prompt. The `language` parameter comes from the user's `preferred_language` profile field (returned by the token endpoint).

Update the opening section of the prompt to include:
- Detect-and-match language behavior
- Farsi and English as mandatory languages
- Default language based on user profile

### 3. Edge Functions — No Changes Needed

- `elevenlabs-conversation-token` already returns `preferred_language`
- `vizzy-context` already returns the snapshot
- `vizzy-briefing` still works as-is

### 4. No Other File Changes

- `LiveChat.tsx`, `AgentWorkspace.tsx`, `FloatingVizzyButton.tsx` all just navigate to `/vizzy` — still works
- `src/types/vizzy.ts` — unchanged
- Router config — unchanged (`/vizzy` route stays)

## New VizzyPage Component Structure

```text
VizzyPage
  |-- Admin role check (redirect if not admin)
  |-- Mic permission request
  |-- Token fetch (elevenlabs-conversation-token)
  |-- WebSocket connection (signed_url only)
  |-- Context push (vizzy-context -> buildVizzyContext with language)
  |-- UI:
  |     |-- Close button (top-right)
  |     |-- Timer (top-left, when connected)
  |     |-- Avatar (center, pulse when speaking)
  |     |-- Status label
  |     |-- Transcript panel (bottom, scrollable)
  |     |-- Controls bar: Volume, Mute, Reconnect, Close
```

## What Users See

- Same full-screen dark overlay as before
- Same brain emoji avatar with pulse animation
- Same transcript panel
- Same mute/volume controls
- **New**: Vizzy responds in Farsi when spoken to in Farsi, English when spoken to in English
- **Gone**: Quotation cards, silent mode badge, WebPhone call/hangup buttons
- **Better**: No more reconnection loops — clean connect or manual retry

