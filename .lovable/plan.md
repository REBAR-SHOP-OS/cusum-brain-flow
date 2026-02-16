

# Audit and Upgrade: App Builder (Architect) -- Full Power Mode

## Issues Found

1. **Input box works** -- confirmed typing works; the training modal overlay may have confused you. No code bug here.
2. **Plus (+) button does nothing** -- it's a dead button with no file upload wired.
3. **No file attachment support** -- no ZIP, image, or PDF upload/analysis capability in Empire Builder (exists in WebsiteChat but not here).
4. **No global "Auto-Fix by ARIA" button** -- errors go to SmartErrorBoundary but only have "Try Again" and "Home" buttons; no "Fix with ARIA" option.
5. **No Friday notification for improvement ideas** -- no cron job exists for this.
6. **Model selection** -- user key routing is in place but model names are `gemini-2.5-pro` without the `google/` prefix when using user key, which may cause API errors.

## Plan

### 1. Fix the Plus Button -- Wire File Uploads (ZIP, Image, PDF)

**File: `src/pages/EmpireBuilder.tsx`**

- Add a hidden `<input type="file">` that accepts images, PDFs, and ZIP files
- Wire the Plus (+) button to trigger the file input
- Show attached file previews (thumbnails for images, file name chips for PDF/ZIP)
- On send:
  - **Images**: Upload to `clearance-photos` bucket, get signed URL, pass as `attachedFiles` to `sendAgentMessage`
  - **ZIP files**: Use existing `analyzeZip()` from `src/lib/zipAnalyzer.ts` to extract structure and embedded images, append summary to message
  - **PDFs**: Upload to storage, pass URL as `attachedFiles` -- the `ai-agent` edge function already has `analyzeDocumentWithGemini()` and `convertPdfToImages()` support

### 2. Add "Auto-Fix with ARIA" Button to SmartErrorBoundary

**File: `src/components/error/SmartErrorBoundary.tsx`**

- After retries are exhausted, add a third button: **"Fix with ARIA"** (with a sparkle/wand icon)
- On click:
  - Navigate to `/empire` with the error details as a URL search param (e.g., `?autofix=...`)
  - Or open a small modal that sends the error directly to the `empire` agent via `sendAgentMessage("empire", "Auto-fix this error: ...")`
- This connects every app error across the platform to ARIA/Architect for diagnosis and fix

**File: `src/pages/EmpireBuilder.tsx`**

- On mount, check for `?autofix=` query param
- If present, automatically send that error description to the Architect agent as the first message
- This creates a seamless flow: error occurs anywhere --> click "Fix with ARIA" --> lands in App Builder with ARIA already diagnosing

### 3. Fix Model Name Prefixes in ai-agent

**File: `supabase/functions/ai-agent/index.ts`** (lines ~4458-4476)

- When `useUserGeminiKey` is true, the model names `gemini-2.5-pro` and `gemini-2.5-flash` need proper handling
- The Gemini API endpoint (generativelanguage.googleapis.com) uses model names like `gemini-2.5-pro` directly
- Ensure the empire agent handler correctly routes to the Google Generative AI API (not the Lovable gateway) when using the user's `GEMINI_API_KEY`
- Verify the fetch URL and headers are correct for direct Gemini API calls

### 4. Friday Improvement Ideas Notification (Cron Job)

**New file: `supabase/functions/friday-ideas/index.ts`**

- A new edge function that:
  1. Checks it's Friday (UTC day 5)
  2. Pulls context: open fix requests, stale human tasks, SEO metrics, machine downtime, delivery issues, order pipeline
  3. Calls Gemini (user key) with a prompt: "Based on this business data, suggest 3-5 improvement ideas for rebar.shop, the ERP, and Odoo CRM"
  4. Creates a notification for admin users with the improvement ideas
  5. Optionally creates `human_tasks` with category "improvement_idea"

**Database: cron job setup**

- Schedule `friday-ideas` to run every Friday at 9 AM AEST (23:00 UTC Thursday) using `cron.schedule`

**Config: `supabase/config.toml`**

- Add `[functions.friday-ideas]` with `verify_jwt = false`

### 5. Update Suggestions and UI Polish

**File: `src/pages/EmpireBuilder.tsx`**

- Add attachment indicator chips below the textarea showing attached files with remove buttons
- Add drag-and-drop support for files onto the input area
- Update placeholder text to mention file support: "Ask Architect to build, diagnose, or drop files here..."

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/EmpireBuilder.tsx` | Add file upload, autofix query param handler, attachment UI |
| `src/components/error/SmartErrorBoundary.tsx` | Add "Fix with ARIA" button after retries exhausted |
| `supabase/functions/ai-agent/index.ts` | Fix model name routing for user Gemini key |
| `supabase/functions/friday-ideas/index.ts` | New cron function for weekly improvement ideas |
| `supabase/config.toml` | Add friday-ideas function config |

## Technical Details

### File Upload Flow in EmpireBuilder
```text
User clicks (+) or drags file
       |
       v
  [Hidden input triggers]
       |
  +----+----+--------+
  |         |        |
Image      PDF      ZIP
  |         |        |
Upload   Upload   analyzeZip()
to       to       extract structure
storage  storage   + images
  |         |        |
Get       Pass     Append summary
signed    URL as   to message +
URL       attached  upload images
  |       File      |
  +----+----+--------+
       |
       v
sendAgentMessage("empire", message, history, context, attachedFiles)
       |
       v
ai-agent processes with Gemini Vision (images/PDF) or text analysis (ZIP)
```

### Auto-Fix Flow
```text
Any page error --> SmartErrorBoundary catches
       |
  Auto-retry (up to 3x)
       |
  [Retries exhausted]
       |
  Show: [Try Again] [Home] [Fix with ARIA]
                              |
                              v
                    Navigate to /empire?autofix={error_details}
                              |
                              v
                    EmpireBuilder reads query param
                              |
                              v
                    Auto-sends to Architect agent
                              |
                              v
                    ARIA diagnoses + creates fix requests
```

### Friday Cron Schedule
- Runs every Friday at 9 AM AEST (Thursday 23:00 UTC)
- SQL: `cron.schedule('friday-ideas', '0 23 * * 4', ...)`
- Sends notification with 3-5 actionable improvement ideas based on live business data

