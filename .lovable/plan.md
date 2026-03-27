

# Add Print, Save PDF & Email-to-Self on Public Quote Page

## Overview
Add three action buttons to the public AcceptQuote page so the customer can **Print**, **Save as PDF**, and **Email the quote to themselves** — all before accepting.

## Changes

### 1. `src/pages/AcceptQuote.tsx` — Add action buttons + email dialog

**Print button**: Uses `window.print()`. Add a print-specific CSS class to hide buttons during print.

**Save PDF button**: Uses `jsPDF` (already in project) to render the quote data into a branded PDF client-side — reuses the same layout structure visible on screen (header, line items, notes, totals).

**Email to Self button**: Opens a small inline dialog asking for the customer's email address, then calls a new `send_quote_copy` action on `send-quote-email` edge function that sends a read-only copy (no accept button) to the provided email.

Add three icon buttons (Printer, Download, Mail) in a toolbar row between the header and the quote body.

### 2. `supabase/functions/send-quote-email/index.ts` — Add `send_quote_copy` action

- Add `"send_quote_copy"` to the Zod action enum
- New action block that:
  - Takes `quote_id` + `customer_email` (required for this action)
  - Builds the same branded quote email as `send_quote` but WITHOUT the "Accept Quote" button
  - Sends via gmail-send using service role key (no user auth needed — public page)
  - Does NOT change quote status

### 3. Print CSS
Add `@media print` styles in a `<style>` tag or Tailwind `print:hidden` classes to hide the action toolbar and accept section during printing.

## UI Layout
```text
┌─────────────────────────────────┐
│  Rebar.shop  Quotation Review   │
├─────────────────────────────────┤
│  QAI-2590     $107,194.19 CAD   │
│  Customer: ...  Valid Until: .. │
├─────────────────────────────────┤
│  [🖨 Print] [📥 Save PDF] [✉ Email]  │  ← NEW toolbar
├─────────────────────────────────┤
│  Line items table ...           │
│  Notes / Terms ...              │
│  Accept section ...             │
└─────────────────────────────────┘
```

## Email Dialog
Simple inline form: email input + Send button. On submit, calls `send-quote-email` with `action: "send_quote_copy"`.

## Files Changed
- `src/pages/AcceptQuote.tsx` — add toolbar, print CSS, PDF generation, email dialog
- `supabase/functions/send-quote-email/index.ts` — add `send_quote_copy` action

