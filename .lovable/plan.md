

## Fix: JARVIS Mode "Error: Failed to fetch"

### Problem
When a user sends a message in JARVIS Mode (LiveChat), the chat returns "Error: Failed to fetch" -- a browser-level network failure indicating the edge function either crashed, timed out, or never returned a proper response.

### Root Causes Found

**1. Request Body Double-Read (Critical)**
In `admin-chat/index.ts`, the handler clones and reads the request body at lines 1004-1006 for ALL requests (to check `publicMode`), then reads it again at line 1098 for authenticated requests. In some Deno edge runtime versions, `req.json()` can fail after `req.clone()` was used, causing a silent crash before any response is sent.

**2. Follow-Up AI Call Uses GPT (Quota Issue)**
The follow-up call at line 1428 uses `gpt-4o-mini`. If the GPT API key has exhausted its quota (which is documented in code comments as a known issue), this call fails inside a background async closure. The error is caught but the writer may not close cleanly, causing the client to see "Failed to fetch".

**3. Insufficient Error Handling in TransformStream**
The background async tool processing (lines 1335-1514) runs in a fire-and-forget async closure. If it throws before writing anything, the readable stream hangs indefinitely -- the browser never receives a response and reports "Failed to fetch".

### Solution

All changes are in one file: `supabase/functions/admin-chat/index.ts`

**A. Fix Body Double-Read**
Replace the `req.clone()` approach with a single body read. Parse the body once at the top and reuse the parsed object:

```text
// Before (lines 1004-1006):
const bodyClone = req.clone();
let parsedBody: any;
try { parsedBody = await bodyClone.json(); } catch { parsedBody = {}; }
...
const body = await req.json();  // line 1098 -- may fail!

// After:
let parsedBody: any;
try { parsedBody = await req.json(); } catch { parsedBody = {}; }
...
const body = parsedBody;  // reuse the same object
```

**B. Switch Follow-Up Call from GPT to Gemini**
Change line 1426-1428 from `gpt-4o-mini` to `gemini-2.5-flash` to avoid GPT quota exhaustion:

```text
// Before:
followUpResp = await callAIStream({
  provider: "gpt",
  model: "gpt-4o-mini",
  ...
});

// After:
followUpResp = await callAIStream({
  provider: "gemini",
  model: "gemini-2.5-flash",
  ...
});
```

**C. Add Safety Net for TransformStream**
Wrap the entire background async closure in a try/catch that ensures the writer always closes, even on unexpected errors. This prevents the browser from hanging:

```text
// Ensure writer.close() is always called:
(async () => {
  try {
    // ... existing tool processing ...
  } catch (bgErr) {
    // ... existing catch ...
  } finally {
    try { writer.close(); } catch { /* already closed */ }
  }
})();
```

**D. Add Content-Type Check for AI Response**
Before parsing the AI response as SSE, verify the Content-Type header. If the AI returns HTML (e.g., an error page), catch it early and show a meaningful error:

```text
if (!followUpResp.ok) {
  const ct = followUpResp.headers.get("content-type") || "";
  if (!ct.includes("text/event-stream") && !ct.includes("application/json")) {
    sendSSE("\n\n--- AI returned unexpected response. Try again. ---");
    // close and return
  }
}
```

### Files to Edit
1. `supabase/functions/admin-chat/index.ts` -- Fix body double-read, switch follow-up to Gemini, add TransformStream safety net

### Impact
- Eliminates "Failed to fetch" caused by body stream exhaustion
- Removes dependency on GPT quota for follow-up calls
- Prevents browser hangs from unclosed streams
- No feature or behavior changes -- same JARVIS functionality
