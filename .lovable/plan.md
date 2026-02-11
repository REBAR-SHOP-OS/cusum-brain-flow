

# Voice Vizzy — Restricted to sattar@rebar.shop

## What Changes from the Previous Plan

One addition: the "Talk to Vizzy" floating button only renders for `sattar@rebar.shop`. All other users never see it.

## Implementation

### 1. New Edge Function: `elevenlabs-conversation-token`

Generates a secure WebRTC token. No change from previous plan.

```text
File: supabase/functions/elevenlabs-conversation-token/index.ts

- Validates auth via requireAuth()
- Fetches user email from profiles table
- REJECTS if email is not sattar@rebar.shop (returns 403)
- Reads ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID from secrets
- Calls ElevenLabs token endpoint
- Returns { token }
```

Server-side enforcement ensures even if someone hacks the UI, they can't get a token.

### 2. New Component: `VoiceVizzy`

```text
File: src/components/vizzy/VoiceVizzy.tsx

- Uses useAuth() to get current user email
- If email !== "sattar@rebar.shop" → returns null (renders nothing)
- Otherwise renders the floating mic button + full-screen Jarvis overlay
- Uses @elevenlabs/react useConversation hook
- Fetches token from edge function on mic tap
- Full-screen dark overlay when active with:
  - Vizzy avatar with glow ring (pulses when speaking)
  - Status: "Listening..." / "Speaking..."
  - Live transcript
  - End button
```

### 3. AppLayout Integration

```text
File: src/components/layout/AppLayout.tsx

- Import and render <VoiceVizzy /> after <MobileNavV2 />
- Component self-gates — returns null for non-sattar users
```

### 4. Install Dependency

```text
npm install @elevenlabs/react
```

### 5. Secret Required

`ELEVENLABS_API_KEY` — needed before implementation can proceed.
`ELEVENLABS_AGENT_ID` — the agent created in ElevenLabs dashboard.

## Access Control (Two Layers)

| Layer | How |
|-------|-----|
| **Frontend** | `VoiceVizzy` checks `user.email === "sattar@rebar.shop"`, renders nothing otherwise |
| **Backend** | Edge function fetches profile email, returns 403 if not sattar@rebar.shop |

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/elevenlabs-conversation-token/index.ts` | CREATE |
| `src/components/vizzy/VoiceVizzy.tsx` | CREATE |
| `src/components/layout/AppLayout.tsx` | MODIFY — add VoiceVizzy |

