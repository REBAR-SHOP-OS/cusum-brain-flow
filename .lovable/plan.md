

# Add Individual Speaker Reports & Final Combined Report Button

## What the user wants
1. **Completed speaker click** → Show that speaker's individual report (currently clicking just selects the speaker for recording, but if they're already completed, it should display their saved report)
2. **Final report icon** at the bottom of the speaker avatars sidebar → Generates and downloads the combined report from all participants

## Changes

### `src/components/office/TranscribeView.tsx`

**1. Add state for viewing a speaker's report:**
- New state: `viewingReport: string | null` — tracks which speaker's report is being viewed
- When clicking a **completed** speaker avatar: instead of selecting for recording, set `viewingReport` to that speaker's name and show their report in a dialog/modal
- When clicking a **non-completed** speaker: keep current behavior (select for recording)

**2. Add "Final Report" button at the bottom of sidebar:**
- Below the 5 speaker avatars, add a circular button with a `FileText` icon (matching the red circle position in the screenshot)
- Style: outlined circle, same size as speaker avatars
- The button is always visible but only clickable when `allSpeakersComplete` is true (or has at least some completed speakers)
- On click: calls the existing `handleFinalReport()` function

**3. Add a report viewer dialog:**
- Import `Dialog` from UI components
- When `viewingReport` is set, show a dialog with:
  - Speaker name as title
  - Their saved report text from `speakerReports[viewingReport]`
  - A close button
- This reuses existing `speakerReports` state — no new data fetching needed

**4. Update speaker avatar click handler:**
```
onClick={() => {
  if (completedSpeakers.has(s.name)) {
    setViewingReport(s.name);  // Show their report
  } else {
    setSelectedSpeaker(s.name); // Select for recording
  }
}}
```

**5. Same changes mirrored in mobile horizontal strip.**

### Summary
| Element | Action |
|---------|--------|
| Completed speaker avatar click | Opens dialog showing that speaker's individual report |
| Final report icon (bottom of sidebar) | Triggers `handleFinalReport()` — generates consolidated PDF from all speakers |
| Non-completed speaker click | Existing behavior (select for recording) |

