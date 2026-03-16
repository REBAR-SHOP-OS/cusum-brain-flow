

# Per-Speaker Recording Flow + Final Consolidated PDF Report

## What the user wants

1. **Sequential per-speaker recording**: When recording stops for a speaker, show a checkmark on their avatar, save their individual report, and auto-advance to the next speaker.
2. **"Final Report" button**: After all 5 speakers are done, generate a consolidated PDF report with each speaker's name as a heading followed by their individual AI summary.

## Current state

- `TranscribeView.tsx` has 5 speaker avatars (RADIN, BEN, VICKY, SAURABEH, KOUROSH) used only as filters
- Realtime transcription via `useRealtimeTranscribe` hook stores all transcripts in one flat list
- `PostProcessToolbar` has a "Summarize" button that generates a single PDF for the whole transcript
- No per-speaker transcript storage or completion tracking exists

## Changes

### File: `src/components/office/TranscribeView.tsx`

1. **Add per-speaker state tracking**:
   - `speakerTranscripts: Record<string, CommittedTranscript[]>` — stores each speaker's committed transcripts
   - `speakerReports: Record<string, string>` — stores each speaker's AI summary
   - `completedSpeakers: Set<string>` — tracks which speakers are done
   - Auto-select the first incomplete speaker on mount

2. **Modify stop-recording behavior**:
   - When user clicks stop (disconnect), save current `committedTranscripts` into `speakerTranscripts[selectedSpeaker]`
   - Call the `transcribe-translate` edge function with `postProcess: "summarize"` to generate that speaker's report and store in `speakerReports[selectedSpeaker]`
   - Add speaker to `completedSpeakers` set
   - Show a green checkmark overlay on completed speaker avatars
   - Auto-advance `selectedSpeaker` to the next incomplete speaker
   - Clear realtime transcripts for the next speaker's session

3. **Add checkmark UI on speaker avatars**:
   - When a speaker is in `completedSpeakers`, render a small green check icon on their avatar circle

4. **Add "Final Report" button**:
   - Visible when all 5 speakers are completed (or as a manual trigger)
   - Calls `transcribe-translate` with all 5 reports combined, asking for a consolidated analysis
   - Generates a PDF using the existing `jsPDF` pattern with sections per speaker:
     - Speaker name as heading
     - Their individual summary underneath
     - A final "Consolidated Analysis" section at the end
   - Downloads the PDF automatically

### File: `src/components/transcribe/PostProcessToolbar.tsx`

- Add a "Final Report" button (icon: `ClipboardList`) that is passed via a new prop `onFinalReport` callback
- The button is enabled only when `allSpeakersComplete` prop is true

### PDF Structure

```text
FINAL MEETING REPORT
Date: ...
Participants: RADIN, BEN, VICKY, SAURABEH, KOUROSH
─────────────────────────────
RADIN
[Radin's individual AI summary]

BEN
[Ben's individual AI summary]

VICKY
[Vicky's individual AI summary]

SAURABEH
[Saurabeh's individual AI summary]

KOUROSH
[Kourosh's individual AI summary]
─────────────────────────────
CONSOLIDATED ANALYSIS
[AI-generated overall analysis combining all 5 reports]

⚠ AI Disclaimer
```

## Flow summary

1. Speaker RADIN is auto-selected
2. User records → stops → checkmark appears on RADIN, auto-advances to BEN
3. Repeat for BEN, VICKY, SAURABEH, KOUROSH
4. After all 5 done, "Final Report" button becomes active
5. Click generates consolidated PDF with all speakers' reports + AI analysis

