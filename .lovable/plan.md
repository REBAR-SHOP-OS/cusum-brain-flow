

## Fix: AI Estimation PDF Extraction Returns 0 Items

### Root Cause (confirmed from logs)
The `ai-estimate` edge function successfully:
1. Downloads and converts the PDF to base64 (106KB) ✓
2. Sends to Gemini 2.5 Pro and gets a 17,866-char response ✓
3. **Fails to parse the response** — `"No JSON array found in AI response"` ✗

The JSON parsing regex `content.match(/\[[\s\S]*\]/)` fails because Gemini wraps its response in markdown code fences (`` ```json [...] ``` ``) or returns explanatory text alongside the array. The greedy regex also can't handle nested arrays reliably.

**Secondary issue**: The uploaded file is a **tabular estimation/bid document** (not a shop drawing), but the prompt is exclusively tuned for RebarCAD shop drawing notation. This means even if parsing succeeds, the extraction prompt won't produce useful results for spreadsheet-style PDFs.

### Fix Plan

**File: `supabase/functions/ai-estimate/index.ts`**

1. **Fix JSON parsing** (critical):
   - Strip markdown code fences before regex matching
   - Log first 500 chars of the AI response for debugging
   - Add fallback: try parsing the entire response as JSON if regex fails
   - Wrap JSON.parse in try/catch to handle malformed JSON gracefully

2. **Adapt extraction prompt for spreadsheet PDFs**:
   - Detect if the file is likely a tabular/estimation document (based on filename or user context)
   - Add a secondary prompt section that handles tabular rebar schedules (columns like Mark, Bar Size, Qty, Length, Shape, etc.)
   - The current prompt only describes RebarCAD drawing notation — add instructions for reading bar schedule tables commonly found in estimation PDFs

3. **Add response logging**:
   - Log the first 500 characters of the AI response to aid future debugging
   - Log the raw content when JSON parsing fails

### Technical Details

**JSON parsing fix:**
```typescript
// Strip markdown fences
let cleaned = content.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

// Try direct parse first
try {
  const parsed = JSON.parse(cleaned);
  extractedItems = Array.isArray(parsed) ? parsed : [parsed];
} catch {
  // Fallback: find JSON array in text
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    extractedItems = JSON.parse(jsonMatch[0]);
  }
}
```

**Prompt addition for tabular PDFs:**
Add a section to the extraction prompt:
```
## TABULAR ESTIMATION FILES
If the document is a spreadsheet or table-format bar schedule (not a drawing), 
extract items from the table rows. Common columns: Mark, Bar Size, No. of Bars, 
Cut Length, Shape/Bend Type, Element, Drawing Ref. Map each row to the same 
output format above.
```

### Files to Update
- `supabase/functions/ai-estimate/index.ts` — JSON parsing + prompt enhancement
- Redeploy the `ai-estimate` edge function

