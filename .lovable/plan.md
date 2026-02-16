

# Replace Google Vision OCR with Gemini Vision (Already Connected)

## Problem
The `google-vision-ocr` edge function requires a Google Cloud service account JSON credential (`GOOGLE_VISION_CREDENTIALS`), which has been difficult to configure correctly. Meanwhile, the project already has full access to Google Gemini vision models through the Lovable AI gateway -- no extra credentials needed.

## Solution
Rewrite the `google-vision-ocr` edge function to use **Gemini 2.5 Flash** (via the Lovable AI gateway) for OCR instead of the Google Cloud Vision API. This eliminates the need for the `GOOGLE_VISION_CREDENTIALS` secret entirely.

## Changes

### 1. Rewrite `supabase/functions/google-vision-ocr/index.ts`
- Remove all Google Cloud Vision API code (JWT signing, service account auth, Vision REST calls)
- Replace with a call to `https://ai.gateway.lovable.dev/v1/chat/completions` using `google/gemini-2.5-flash` with vision capability
- For `imageUrl`: pass the URL directly to the model
- For `imageBase64`: pass as a base64 data URI
- Extract text from the model response and return in the same format (`fullText`, `textBlocks`, `rawResponse`) so all existing callers (including `ai-agent`) continue working without changes

### 2. No changes needed to:
- `supabase/functions/ai-agent/index.ts` (calls `google-vision-ocr` -- same API contract)
- `supabase/functions/pdf-to-images/index.ts` (unchanged)
- Any frontend code

## Technical Details

The new OCR function will:
- Accept the same request body (`imageUrl` or `imageBase64`, optional `features`)
- Send the image to Gemini with a prompt: "Extract ALL text from this image exactly as it appears, preserving layout and structure"
- Return `fullText` (the extracted text) and empty `textBlocks` array (bounding boxes not available from Gemini, but not used by any caller)
- No API key needed -- the Lovable AI gateway handles authentication automatically

