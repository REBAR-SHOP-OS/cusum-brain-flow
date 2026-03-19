

# Add Manual Language-Specific Record Buttons (Google Translate Style)

## What the User Wants

Two separate record buttons in the bottom bar — one labeled **EN** (English) and one labeled **FA** (فارسی) — so the user can manually specify the source language before recording. Like Google Translate: press the EN button to record English (translates to Farsi), press FA to record Farsi (translates to English).

## Current Behavior

- Single mic orb auto-detects language via `sourceLang: "auto"`
- The `translate-message` edge function already supports explicit `sourceLang` parameter
- No changes needed to the backend

## Changes

### 1. Update `useRealtimeTranscribe` hook to accept source language
**File: `src/hooks/useRealtimeTranscribe.ts`**

- Add a `sourceLang` state (`"auto" | "en" | "fa"`) with a setter
- Pass `sourceLang` to the `translate-message` call instead of hardcoded `"auto"`
- When `sourceLang` is `"en"`: translate to `["fa"]` only, show original in EN column, translation in FA column
- When `sourceLang` is `"fa"`: translate to `["en"]` only, show original in FA column, translation in EN column
- Store `sourceLang` per transcript entry so the UI knows which column is original vs translated

### 2. Add two language record buttons to the bottom bar
**File: `src/pages/AzinInterpreter.tsx`**

Replace the single `AzinVoiceOrb` with a Google Translate-style layout:

```text
┌─────────────────────────────────────────┐
│   [🎙 EN]    [AZIN avatar]    [🎙 فا]  │
└─────────────────────────────────────────┘
```

- **EN button**: Sets `sourceLang` to `"en"`, starts/stops recording. When active, shows English mic pulsing.
- **FA button**: Sets `sourceLang` to `"fa"`, starts/stops recording. When active, shows Farsi mic pulsing.
- Each button shows the language label and a mic icon
- Active button gets the indigo glow/pulse animation (reuse existing AzinVoiceOrb styling)
- Only one can be active at a time (pressing one while the other is active switches)

### 3. Update transcript display logic
**File: `src/pages/AzinInterpreter.tsx`**

- When `sourceLang === "en"`: EN column shows original text, FA column shows translation
- When `sourceLang === "fa"`: FA column shows original text, EN column shows translation
- Each transcript entry carries its `sourceLang` so mixed-language sessions display correctly

### 4. Create `LanguageMicButton` component
**File: `src/components/azin/LanguageMicButton.tsx`**

A compact mic button with:
- Language label (EN or فا)
- Mic/MicOff icon
- Active state: indigo glow + pulse animation
- Connecting state: loading spinner
- Disabled state when the other language is recording

## Technical Details

- The `translate-message` edge function already accepts `sourceLang` and `targetLangs` — no backend changes needed
- `CommittedTranscript` interface gets a new `sourceLang` field to track per-entry language direction
- The existing AZIN avatar button (voice chat overlay) stays in the center between the two mic buttons

