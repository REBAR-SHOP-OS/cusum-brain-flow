

# Fix: Clean & Formatted PDF Output

## Problem
The PDF renders raw markdown (`##`, `**`, `-`) as plain text. The `addText` function dumps everything as uniform plain text with no visual hierarchy — headings, bold, and bullets all look the same.

## Solution
Create a **markdown-aware PDF renderer** that parses the AI's markdown output and applies proper formatting:

### `src/components/transcribe/PostProcessToolbar.tsx` — `generatePdfReport`
### `src/components/office/TranscribeView.tsx` — `handleFinalReport`

Both files use identical `addText` logic. Extract a shared helper `addMarkdownToPdf(doc, text, ...)` that:

1. Splits text by lines
2. Detects markdown patterns and renders accordingly:
   - `## Heading` → bold, larger font (13pt), navy color, with spacing
   - `**bold text**` → bold style inline
   - `- bullet item` → indented with a bullet character (`•`)
   - Regular text → normal style
3. Strips the markdown syntax characters (`##`, `**`, `-`) before rendering

### Implementation — shared helper function

Create `src/lib/pdfMarkdownRenderer.ts`:

```ts
export function addMarkdownToPdf(doc: any, text: string, options: {
  margin: number, maxWidth: number, pageHeight: number, startY: number
}): number {
  let y = options.startY;
  const lines = text.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { y += 3; continue; }
    
    // Check page break
    if (y > options.pageHeight - 25) { doc.addPage(); y = options.margin; }
    
    if (trimmed.startsWith("## ")) {
      // Section heading
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 80);
      y += 4;
      doc.text(trimmed.replace(/^##\s*/, ""), options.margin, y);
      y += 7;
    } else if (trimmed.startsWith("- ")) {
      // Bullet point - strip bold markers inside
      const content = trimmed.slice(2).replace(/\*\*(.*?)\*\*/g, "$1");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      const wrapped = doc.splitTextToSize(content, options.maxWidth - 8);
      doc.text("•", options.margin + 2, y);
      for (const wl of wrapped) {
        if (y > options.pageHeight - 25) { doc.addPage(); y = options.margin; }
        doc.text(wl, options.margin + 8, y);
        y += 4.5;
      }
    } else {
      // Normal text - strip bold markers
      const content = trimmed.replace(/\*\*(.*?)\*\*/g, "$1");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      const wrapped = doc.splitTextToSize(content, options.maxWidth);
      for (const wl of wrapped) {
        if (y > options.pageHeight - 25) { doc.addPage(); y = options.margin; }
        doc.text(wl, options.margin, y);
        y += 4.5;
      }
    }
  }
  return y;
}
```

### Changes to existing files:
- **`PostProcessToolbar.tsx`** — In `generatePdfReport`, replace `addText(summary, 10, ...)` with `addMarkdownToPdf(doc, summary, ...)`
- **`TranscribeView.tsx`** — In `handleFinalReport`, replace `addText(speakerReports[...])` and `addText(consolidatedAnalysis, ...)` with `addMarkdownToPdf`

Both files import from the new shared helper. The transcript raw text sections keep using `addText` (no markdown there).

### Files
- **Create**: `src/lib/pdfMarkdownRenderer.ts`
- **Edit**: `src/components/transcribe/PostProcessToolbar.tsx`
- **Edit**: `src/components/office/TranscribeView.tsx`

