

# Add PDF Report Download to Nila Interpreter Voice Chat

## What It Does

Adds a download button next to the "End Call" button in the Nila interpreter voice chat. When clicked, it generates a PDF report summarizing the entire conversation in English, ready for download.

## Changes

### 1. `src/components/azin/AzinInterpreterVoiceChat.tsx`

- Import `FileText` icon from lucide-react and `jsPDF` 
- Add a "Download Report" button next to the "End Call" button (only visible when there are transcripts)
- Create a `generateConversationPdf()` function that:
  - Collects all transcripts (original + translation pairs)
  - Builds a formatted PDF with:
    - Title: "Nila Interpreter — Conversation Report"
    - Date/time header
    - Each exchange listed with speaker direction (English → Farsi or Farsi → English)
    - All text displayed in English (originals for English segments, translations for Farsi segments)
  - Uses `addMarkdownToPdf` from `src/lib/pdfMarkdownRenderer.ts` for consistent formatting
  - Triggers browser download as `nila-report-YYYY-MM-DD.pdf`

### 2. No backend changes needed

The PDF is generated entirely client-side using jsPDF + the existing `pdfMarkdownRenderer` utility. The transcript data is already available in the component state.

## UI Layout

The download button appears as a small icon button in the bottom bar, next to the End Call button — styled as a ghost/muted button with a `FileText` icon.

