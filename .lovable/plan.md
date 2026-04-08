

# Fix Download Button — Generate PDF Instead of Opening HTML in New Tab

## Problem

The download icon (red arrow button) in Vizzy Brain calls the `generate-daily-report-pdf` edge function which returns HTML. The current client code opens this HTML in a new browser tab (`window.open`). The toast "Report generated — opening in new tab" is a **success message**, not an error — but the behavior is wrong. The user expects a **PDF file download**, not an HTML page in a new tab.

## Root Cause

In `VizzyBrainPanel.tsx` (line 428-431), the code creates an HTML blob and opens it in a new tab:
```typescript
const blob = new Blob([data.html], { type: "text/html" });
const blobUrl = URL.createObjectURL(blob);
window.open(blobUrl, "_blank");
```

There is no PDF conversion happening — the function name says "pdf" but it only generates HTML.

## Solution

Convert the HTML to a real PDF on the client side using `html2canvas` + `jsPDF` (already in the project dependencies), then trigger a file download.

### Change: `src/components/vizzy/VizzyBrainPanel.tsx` — `GeneralReportPDFButton`

Replace the `window.open` logic (lines 428-431) with:

1. Create a hidden iframe, inject the HTML into it
2. Use `html2canvas` to render the iframe content to a canvas
3. Convert canvas to PDF pages using `jsPDF` (handling multi-page with A4 dimensions)
4. Trigger `pdf.save("report-{userName}-{date}.pdf")` for a direct download
5. Update toast to "PDF downloaded successfully"

This approach handles Unicode/Persian text correctly since `html2canvas` renders exactly what the browser renders, including all fonts and styling.

| File | Change |
|------|--------|
| `VizzyBrainPanel.tsx` | Replace `window.open(blob)` with html2canvas → jsPDF → `pdf.save()` for real PDF download |

