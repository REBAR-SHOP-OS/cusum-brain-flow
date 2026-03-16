

# Add Speaker Circles to Transcribe Page

## What
Add 5 clickable speaker avatars (RADIN, BEN, VICKY, SAURABEH, KOUROSH) along the left side of the Transcribe page. Each represents a participant in a conversation with NEEL. Clicking one filters the transcript to show only that person's segments.

## Layout
Based on the screenshot, the circles are positioned vertically along the left margin, next to different sections of the page. They will be rendered as a fixed/absolute sidebar of circular avatars with initials.

```text
┌──────────────────────────────────┐
│ [R] Header                       │
│ [B] Tabs (Realtime/Upload/...)   │
│ [V] Mic button area              │
│ [S] Live transcript area         │
│ [K] Advanced options area        │
└──────────────────────────────────┘
```

## Changes

### `src/components/office/TranscribeView.tsx`
1. Add a `selectedSpeaker` state (`string | null`)
2. Add a `SPEAKERS` constant array: `["RADIN", "BEN", "VICKY", "SAURABEH", "KOUROSH"]` with distinct colors
3. Render a vertical column of circular avatar buttons on the left side of the page (inside a flex wrapper)
4. Each circle shows the first letter + full name below, with a colored background
5. Clicking a circle sets `selectedSpeaker`; clicking again deselects (shows all)
6. Active circle gets a ring/border highlight
7. Pass `selectedSpeaker` to `LiveTranscript` so it can filter committed transcripts by speaker name
8. When a speaker is selected, show a small banner: "Showing conversation: {NAME} ↔ NEEL" with a clear filter button

### `src/components/transcribe/LiveTranscript.tsx`
- Add optional `filterSpeaker` prop
- When set, only show transcript entries that match the speaker (for now, since realtime doesn't have speaker diarization, this will be a visual filter placeholder that becomes functional when speaker labels are available)

### Visual Design
- Circles: 40px, colored background matching `SPEAKER_COLORS`, white text initial
- Positioned as a vertical strip to the left of the main content
- On mobile: horizontal strip above content
- Subtle tooltip with full name on hover

