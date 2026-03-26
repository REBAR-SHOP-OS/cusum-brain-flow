
## Fix plan for incorrect text/file rendering in the highlighted Dock Chat area

### What I found
The issue is in `src/components/chat/DockChatBox.tsx`, and it is more than a CSS problem.

### Root cause
1. **Files are being serialized into the message text**
   - In `handleSend`, attachments are converted into markdown like:
     ```ts
     📎 [file.pdf](https://...)
     ```
   - But `sendMutation.mutateAsync()` is called **without** the `attachments` field.
   - Result: the file lives inside `original_text` instead of the structured `attachments` array.

2. **Rendering parses attachments from the translated display text**
   - The bubble currently does:
     ```ts
     const { cleanText, parsedAttachments } = parseAttachmentLinks(displayText);
     ```
   - `displayText` may be translated text, and translation can alter the markdown/file syntax.
   - When that happens, parsing fails and the raw `[image.png](https://...)` text appears inside the bubble.

3. **Mention parsing is too aggressive for Persian/RTL**
   - `renderMentionText()` uses:
     ```ts
     text.split(/(@\S+)/g)
     ```
   - This can incorrectly swallow nearby Unicode/Persian text and produce unstable rendering.

4. **Dock Chat uses an older rendering path than Team Hub**
   - `MessageThread.tsx` already has a more complete attachment pipeline.
   - `DockChatBox.tsx` has diverged, which is why this specific panel behaves incorrectly.

---

## Implementation plan

### 1) Fix message sending at the source
Update `src/components/chat/DockChatBox.tsx` so new messages send files through the structured `attachments` field instead of embedding file markdown into the text.

- Keep `text` as only the real user message
- Pass `attachments` to `sendMutation.mutateAsync(...)`
- For file-only messages, send a minimal placeholder text only if needed for empty-body handling, but do **not** embed raw links

This is the real root fix for new messages.

### 2) Separate “text rendering” from “attachment rendering”
Refactor Dock Chat rendering so it does **not** derive attachments from translated text.

Use this source split:
- **Text source**: translated/original visible message text
- **Attachment source**: `msg.attachments` plus a fallback parse from `msg.original_text` for old messages

That way:
- old messages still work
- new messages render correctly
- translation can no longer break file rendering

### 3) Add a robust shared message-content helper
In `src/lib/chatFileUtils.ts`, introduce a shared parser/helper for chat message content that:
- extracts markdown-style legacy attachments from `original_text`
- merges them with `msg.attachments`
- deduplicates by URL
- returns clean visible text without attachment tokens
- avoids depending on translated text for attachment extraction

This removes the fragile inline logic from `DockChatBox`.

### 4) Replace raw file buttons with the proper file card UI
Use the existing file-card pattern (`InlineFileLink`) or the same behavior inside Dock Chat so PDF/file attachments always render as:
- file name
- download button
- copy button

This will match the behavior you already wanted elsewhere and stop raw URLs/markdown from appearing.

### 5) Fix mention rendering for Persian/RTL safely
Replace the current `(@\S+)` split with a safer mention parser that only highlights known mention tokens and does not consume adjacent Persian text.

Goal:
- mentions still highlight
- Persian sentences remain intact
- no disappearing or malformed segments

### 6) Tighten RTL rendering behavior
In Dock Chat bubbles:
- prefer `dir="auto"` or a safer per-text direction strategy
- keep RTL alignment support
- preserve wrapping for mixed Persian + filenames + Latin URLs

This is a secondary stability fix, not the main root cause.

---

## Files to update
- `src/components/chat/DockChatBox.tsx`
- `src/lib/chatFileUtils.ts`
- possibly `src/components/pipeline/InlineFileLink.tsx` if a small prop/helper is needed for reuse in chat bubbles

---

## Expected result
After this fix:
- Persian text will render correctly in the highlighted Dock Chat area
- PDF/file messages will show as a clean file card, not raw markdown/url text
- download and copy actions will appear consistently
- translations will no longer break attachment display
- old legacy messages will still render properly

---

## Validation checklist
1. Send a Persian-only text message in Dock Chat
2. Send a PDF/file-only message in Dock Chat
3. Send a Persian text + file together
4. Open an older message that stored attachment markdown in `original_text`
5. Verify file card shows:
   - correct filename
   - download
   - copy link
6. Verify no raw `[file](url)` text is visible anymore
7. Verify mixed RTL/LTR content still wraps correctly

