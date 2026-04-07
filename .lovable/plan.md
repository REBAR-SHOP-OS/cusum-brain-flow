

# Daily General Report — Full System PDF Generation

## What It Does
When clicking the General Report clipboard icon (circled in screenshot), instead of copying a short summary to clipboard, it will call a new edge function that:
1. Gathers ALL system data for the day (same data `vizzy-pre-digest` uses)
2. Sends it to AI to produce a comprehensive written report covering every department
3. Renders the AI output as a professional PDF
4. Uploads to storage and opens the download URL

## Architecture

```text
Button Click → Edge Function (generate-daily-report-pdf)
  ├── buildFullVizzyContext() — all ERP data
  ├── AI (Gemini) — write comprehensive report
  ├── Render PDF (HTML → storage)
  └── Return signed download URL
```

## Changes

### 1. New Edge Function: `supabase/functions/generate-daily-report-pdf/index.ts`
- Reuses `buildFullVizzyContext` to gather all operational data (financials, production, CRM, team, deliveries, emails, calls, machines, time clock)
- Calls Gemini to produce a long-form daily report organized by department:
  - Executive Summary
  - Team & Attendance (clock-in/out, hours, activity counts)
  - Financial Health (AR, AP, overdue invoices, payments)
  - Production (machines, cut plans, queue)
  - Sales Pipeline (leads, hot deals, win rate)
  - Customer Support (calls, emails, escalations)
  - Deliveries & Logistics
  - AI Agent Activity
  - Red Flags & Recommendations
- Renders the markdown output into a styled HTML document
- Uploads as PDF-ready HTML to `invoice-pdfs` bucket (reuse existing bucket)
- Returns a signed download URL (30-day validity)

### 2. Update `SectionReportButton` for General Report (`VizzyBrainPanel.tsx`)
- Replace the General Report's `SectionReportButton` with a new `GeneralReportPDFButton` component
- Shows a loading spinner while generating
- Calls `supabase.functions.invoke("generate-daily-report-pdf")`
- Opens the returned PDF URL in a new tab
- Falls back to clipboard copy if the edge function fails

### 3. No Database Changes
- Reuses existing `invoice-pdfs` storage bucket
- No new tables needed

## Technical Details
- The edge function produces a self-contained HTML document styled for print/PDF, with page breaks between sections
- The HTML is uploaded to storage as `.html` with instructions to "Print to PDF" or directly as a rendered document the browser can save
- Alternative: generate actual PDF using the `addMarkdownToPdf` pattern already in the codebase, but server-side via jsPDF in Deno
- Report length target: 3,000-5,000 words covering all departments comprehensively
- AI prompt enforces: use real numbers, no placeholders, section headers, bullet points for details

