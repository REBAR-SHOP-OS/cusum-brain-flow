

# Add Live Translation Panel on the Right Side

## What
Add a right-side column/panel to the Transcribe page that shows a live translation of the transcript into a user-selected language. A language selector icon at the top of the panel lets the user choose the target language.

## Layout

```text
┌─────────┬──────────────────────┬─────────────────────┐
│ Speaker │   Main Content       │  Live Translation   │
│ Circles │   (existing)         │  [🌐 Language ▾]    │
│  [R]    │                      │                     │
│  [B]    │  Tabs / Mic / etc    │  Translated text    │
│  [V]    │                      │  appears here in    │
│  [S]    │  Live Transcript     │  real-time as       │
│  [K]    │                      │  segments commit    │
│         │                      │                     │
└─────────┴──────────────────────┴─────────────────────┘
```

## Changes

### `src/components/office/TranscribeView.tsx`
1. Add `translationLang` state (default `"fa"` / Farsi, selectable from LANGUAGES list)
2. Wrap the existing layout in a 3-column flex: speakers | main | translation panel
3. Add a right-side panel (`w-80`) containing:
   - A language selector icon/dropdown (Globe icon + Select) at the top
   - A `ScrollArea` that displays each committed transcript segment translated into the selected language
4. On mobile: the translation panel collapses below the main content

### `src/hooks/useRealtimeTranscribe.ts`
- Already translates to English. No changes needed here — the right panel will do its own translation calls.

### New: Translation logic in TranscribeView
- When `translationLang` changes or new committed transcripts arrive, fire translation requests (to `translate-message` edge function) for each new segment into the selected language
- Store translations in a local `Map<string, string>` keyed by transcript entry ID
- Show "translating…" indicator per segment while pending

### Visual Design
- Panel has a subtle border-left, matching the page background
- Globe icon button opens language dropdown
- Each translated line shows timestamp + translated text
- Muted original text shown below each translation for reference
- Hidden when no language is selected or on very small screens

