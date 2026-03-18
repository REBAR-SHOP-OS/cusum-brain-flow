

## Plan: Sales Agent Image Analysis → Auto-Quote → PDF → Email Flow

### What the User Wants
When a user drops a screenshot (e.g., a rebar schedule, a drawing, or a customer request) into the Blitz (Sales) chat:
1. Analyze the image automatically, extract rebar requirements
2. Don't ask questions — show the calculation directly using smart defaults
3. If approved, create a quotation in the Sales Quotations section (`sales_quotations` table)
4. Show the PDF to the salesperson
5. If accepted, prepare a professional email with signature and send it

### Current State
- **Estimation agent** handles image analysis via `performMultiPassAnalysis` (OCR + Gemini vision) — but sales agent skips this entirely
- **Sales agent** has `generate_sales_quote` tool that calls the quote engine
- **Sales agent** has `send_email` tool for sending emails
- **Sales Quotations** page (`/sales/quotations`) uses `sales_quotations` table
- There is NO image analysis block for `agent === "sales"` in `ai-agent/index.ts`
- There is NO tool to save a quote to `sales_quotations` table from the agent

### Changes

**1. `supabase/functions/ai-agent/index.ts` — Add image analysis for sales agent**
After the existing `estimation` file analysis block (line ~539), add a similar block for `agent === "sales"`:
- When `attachedFiles` are present and agent is `sales`, run `performMultiPassAnalysis` on images/PDFs
- Inject the extracted text into `mergedContext.salesImageAnalysis`
- This gives Blitz the rebar data from screenshots without needing to ask questions

**2. `supabase/functions/_shared/agents/sales.ts` — Update Blitz prompt**
Add instructions telling Blitz:
- When image analysis results are in context, extract rebar requirements and call `generate_sales_quote` immediately with `action: "quote"` using smart defaults
- Never ask clarifying questions when an image is analyzed — just generate the quote
- After generating the quote, present the calculation and ask "Approve this quotation?"
- On approval, call `save_sales_quotation` tool to persist it, then offer to send the PDF via email

**3. `supabase/functions/_shared/agentTools.ts` — Add `save_sales_quotation` tool**
New tool available to `sales` and `commander` agents:
- Parameters: `quotation_number`, `customer_name`, `customer_company`, `amount`, `notes`, `expiry_date`, `line_items` (array), `lead_id` (optional)
- Saves to `sales_quotations` table
- Returns the created quotation ID

**4. `supabase/functions/_shared/agentToolExecutor.ts` — Implement `save_sales_quotation`**
- Generate quotation number using `Q{YYYY}{NNNN}` pattern (query latest from table)
- Insert into `sales_quotations` with `status: "draft"`, company_id from context
- Store line_items in metadata or the quotation's notes
- Return quotation ID and number

**5. `supabase/functions/_shared/agentTools.ts` — Add `send_quotation_email` tool**
New tool for sending professional quotation emails:
- Parameters: `quotation_id`, `to_email`, `customer_name`, `subject` (optional)
- Generates a professional HTML email with:
  - Company branding (REBAR.SHOP)
  - Line items table
  - Total amount
  - Validity period
  - Professional signature with sender's name, title, phone, email
- Uses the existing `send_email` tool infrastructure (Gmail)
- Updates quotation status to "sent"

**6. `supabase/functions/_shared/agentToolExecutor.ts` — Implement `send_quotation_email`**
- Fetch quotation from `sales_quotations` by ID
- Build professional HTML email body with line items, totals, and signature
- Call the send_email logic (Gmail API)
- Update quotation status to `sent`

### Technical Details

**Image analysis flow in ai-agent/index.ts:**
```typescript
// After the empire block (~line 572), add:
if (agent === "sales" && attachedFiles.length > 0) {
  let imageAnalysisText = "";
  for (const file of attachedFiles) {
    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|tiff?)$/i.test(file.name);
    const isPdf = /\.pdf$/i.test(file.name);
    if (isImage) {
      const ocrResult = await performOCR(file.url);
      if (ocrResult.fullText) imageAnalysisText += `\n--- OCR: ${file.name} ---\n${ocrResult.fullText}`;
      else {
        const result = await analyzeDocumentWithGemini(file.url, file.name, "Extract all rebar details...");
        if (result.text) imageAnalysisText += `\n--- Analysis: ${file.name} ---\n${result.text}`;
      }
    } else if (isPdf) {
      const pdfResult = await convertPdfToImages(file.url, 5);
      for (const page of pdfResult.pages) {
        const pageOcr = await performOCROnBase64(page);
        if (pageOcr.fullText) imageAnalysisText += `\n${pageOcr.fullText}`;
      }
    }
  }
  if (imageAnalysisText) mergedContext.salesImageAnalysis = imageAnalysisText;
}
```

**Prompt addition for Blitz:**
```
## Screenshot/Image Analysis
When salesImageAnalysis appears in context, you have OCR/vision results from user-uploaded images.
- Extract ALL rebar details (bar sizes, quantities, lengths, shapes)
- Immediately call generate_sales_quote with action: "quote" — do NOT ask questions
- Use smart defaults for missing info (20ft length, straight bars, no coating, no delivery)
- Present the calculation in a clean table format
- Ask: "✅ Approve this quotation? I'll save it and can email it to the customer."
- On approval: call save_sales_quotation, then offer to send via email with professional signature
```

### Files to Change
1. `supabase/functions/ai-agent/index.ts` — sales image analysis block
2. `supabase/functions/_shared/agents/sales.ts` — prompt update
3. `supabase/functions/_shared/agentTools.ts` — add 2 new tools
4. `supabase/functions/_shared/agentToolExecutor.ts` — implement 2 new tools

