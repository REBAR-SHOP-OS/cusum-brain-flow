

# Quotation, Invoice, Packing Slip Generation + Smart File Handling in Live Chat

## Overview

Three major enhancements:

1. **Document Generation**: Add tools to the `website-agent` so the AI can generate branded Quotation, Invoice, and Packing Slip documents directly in the live chat -- rendered as beautiful HTML that visitors can print/save as PDF.

2. **Drawing Upload --> New Lead**: When a visitor uploads a structural drawing (PDF/image), the AI detects it and automatically creates a new lead in the pipeline with the file attached, so the sales team can follow up.

3. **Barlist Upload --> Instant Quote**: When a visitor uploads a bar bending schedule (barlist), the AI extracts the rebar items using the existing `extract-manifest` edge function and generates an instant rough quotation with pricing estimates, right in the chat.

## What the Customer Will Experience

### Quotation in Chat
- Visitor asks for a quote and provides items/details
- AI collects info, then generates a formatted quotation matching the existing Rebar.Shop branded template (same layout as the PDF you shared: logo, line items, inclusions, totals with HST 13%, signature area, footer)
- Quotation is rendered as styled HTML inside a chat message -- visitor can print or save as PDF directly from browser

### Drawing Upload
- Visitor attaches a PDF or image of a structural drawing
- AI recognizes it as a drawing (not a barlist) based on content analysis
- AI creates a new lead in the pipeline with source "website_chat" and attaches the file
- AI responds: "I've forwarded your drawing to our estimating team. They'll prepare a detailed quote and reach out shortly."

### Barlist Upload --> Instant Pricing
- Visitor attaches a bar bending schedule (PDF/image/spreadsheet)
- AI recognizes it as a barlist and calls the `extract-manifest` endpoint to parse items
- Using the extracted items (bar codes, quantities, lengths), AI generates an instant rough quotation with estimated pricing
- AI presents the quotation in the branded template format and notes it's an estimate pending formal review

## Technical Details

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/website-agent/index.ts` | Add 3 new tools: `generate_quotation`, `create_lead_from_drawing`, `process_barlist_quote`. Update system prompt with file handling instructions |
| `supabase/functions/support-chat/index.ts` | Update AI prompt to handle file uploads similarly (drawing detection, barlist detection) and instruct visitors to use the main widget for document features |

### New Tools for `website-agent`

**1. `generate_quotation`**
- Input: customer_name, customer_email, project_name, items (array of description/qty/unit_price), inclusions, exclusions, notes
- Output: Branded HTML quotation matching the existing InvoiceTemplate/QuotationTemplate style
- Also creates a `quote_requests` record in the database
- Returns the HTML so the AI can embed it in the chat message

**2. `create_lead_from_drawing`**
- Input: customer_name, customer_email, project_name, file_description, notes
- Creates a new lead in `leads` table with stage "new", source "website_chat"
- Creates a `quote_requests` record linked to it
- Returns confirmation with quote number

**3. `process_barlist_quote`**
- Input: barlist_text (the extracted/OCR'd content from the uploaded file), customer_name, customer_email, project_name
- Calls the AI to parse rebar items from the text
- Calculates rough pricing using standard rates (per kg based on bar size)
- Returns a formatted quotation HTML with estimated pricing
- Notes clearly that this is an estimate pending formal review

### System Prompt Updates

Add to the `website-agent` system prompt:

```
## File Upload Handling
When a visitor uploads a file:

1. DRAWING DETECTION: If the file appears to be a structural/engineering drawing 
   (mentions footings, beams, columns, slabs, structural details, has drawing numbers):
   - Collect visitor name and email if not already known
   - Use create_lead_from_drawing to create a pipeline lead
   - Let them know the estimating team will prepare a detailed quote

2. BARLIST DETECTION: If the file appears to be a bar bending schedule / barlist / 
   rebar schedule (has columns like Mark, Bar Size, Shape, Length, Qty):
   - Use process_barlist_quote to extract items and generate instant pricing
   - Present the rough quotation in the chat
   - Note that formal pricing will follow from the team

3. QUOTATION GENERATION: When you have enough info to create a quote:
   - Use generate_quotation to produce a branded quote document
   - Always include HST 13% tax
   - Include standard terms and delivery notes
```

### Quotation HTML Template

The generated HTML will match the existing brand style from `QuotationTemplate.tsx`:
- Rebar.Shop Inc header with logo placeholder and address (9 Cedar Ave, Thornhill L3T 3W1)
- Customer info section
- Line items table (Description, Qty, Unit Price, Amount)
- Inclusions/Exclusions checklist
- Subtotal, HST 13%, Total
- Footer with phone, email, HST number
- Print-friendly CSS included inline

### Standard Pricing for Instant Barlist Quotes

Rough pricing table used for instant estimates (per kg):
- N12: $2.20/kg (0.888 kg/m)
- N16: $2.10/kg (1.58 kg/m)  
- N20: $2.00/kg (2.47 kg/m)
- N24: $1.95/kg (3.55 kg/m)
- N28: $1.90/kg (4.83 kg/m)
- N32: $1.85/kg (6.31 kg/m)
- N36: $1.80/kg (7.99 kg/m)
- Fabrication surcharge: +$0.30/kg for bends
- These are estimate prices -- clearly marked as "Budget Estimate, Subject to Formal Quote"

### Support Chat Integration

Update `support-chat/index.ts` AI prompt to add:
- When a visitor describes uploading a drawing or barlist, guide them to send the file
- The support chat doesn't have tool-calling, so it should collect details and create a `quote_requests` record directly via the conversation flow
- The AI should ask for details and let them know the team will follow up

### No Database Changes

All data flows into existing tables:
- `quote_requests` for quotations
- `leads` for drawing-based leads
- `activity_events` for logging

