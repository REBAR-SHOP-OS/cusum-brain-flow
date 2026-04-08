

# Open Report in a Modal Instead of Copying to Clipboard

## Problem
Currently, the "Generate full user report" button (FileText icon) copies the report text to clipboard silently. The user wants it to **open a visible page/modal** displaying the full report text.

## Solution
Replace the clipboard-copy behavior with a **Dialog/modal** that displays the generated report text in a readable, scrollable view. Keep a "Copy" button inside the modal for convenience.

### Change: `src/components/vizzy/VizzyBrainPanel.tsx`

1. Add `useState` for controlling a report modal (`showReport` + `reportText`)
2. Change the button's `onClick` to call `generateReport()` and set state to open the modal
3. Render a `Dialog` with the report text displayed in a `<pre>` block (preserving formatting)
4. Include a "Copy to clipboard" button inside the modal

```text
┌──────────────────────────────────┐
│  📊 Full Report — Zahra         │  ✕
│  📅 Date: Apr 8, 2026           │
│  ─────────────────────────────  │
│  ⏰ Status: Clocked In          │
│  🕐 Hours: 3.3h                 │
│  📋 Activities: 86              │
│  ...                            │
│                                 │
│  [Copy to Clipboard]            │
└──────────────────────────────────┘
```

| File | Change |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | Add Dialog state to `UserFullReportButton`, show report text in modal instead of silent clipboard copy |

One component change, one file. Uses existing `Dialog` UI components already in the project.

