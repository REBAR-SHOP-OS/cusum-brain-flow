
# Add Image Analysis to Website Chat

## Problem
When you upload a screenshot or photo in the chat, it just attaches a link. The AI (JARVIS) never actually sees or analyzes the image -- it only gets a text URL. You want the AI to look at the image and help based on what it sees.

## Solution
Two changes are needed:

### 1. Frontend: Send image URLs separately (`WebsiteChat.tsx`)
Instead of embedding image URLs as markdown links in the message text, send them as a separate `imageUrls` array in the request body. This lets the backend know which URLs are images that need visual analysis.

- In `handleSend`, collect uploaded image URLs into an `imageUrls` array
- Pass `imageUrls` alongside `messages` in the fetch body
- Still show the image thumbnails in the user's chat bubble for context

### 2. Backend: Convert image URLs to multimodal content (`admin-chat/index.ts`)
Before sending messages to the AI gateway, detect any messages that include `imageUrls` and convert them into the multimodal format the AI model expects.

- Parse `imageUrls` from the request body
- When building the messages array for the AI, convert the last user message from a plain string into a multimodal content array:
  ```
  { role: "user", content: [
    { type: "text", text: "user's question" },
    { type: "image_url", image_url: { url: "signed-url" } }
  ]}
  ```
- Add a line to the system prompt telling JARVIS it can analyze uploaded images
- This works with the existing `google/gemini-3-pro-preview` model which supports vision

## Technical Details

**`src/components/website/WebsiteChat.tsx`**:
- Change `handleSend` to build an `imageUrls: string[]` from uploaded attachments
- Pass `{ messages: history, currentPage, imageUrls }` in the fetch body (via `sendMessage`)
- Show image thumbnails in user message bubbles instead of raw markdown links

**`src/hooks/useAdminChat.ts`**:
- Update `sendMessage` signature to accept optional `imageUrls: string[]`
- Include `imageUrls` in the POST body to admin-chat

**`supabase/functions/admin-chat/index.ts`**:
- Extract `imageUrls` from `body` alongside `messages` and `currentPage`
- Before calling the AI gateway, transform the last user message: if `imageUrls` has entries, convert `content` from a string to a multimodal array with text + image_url blocks
- Add to system prompt: "You can analyze images the user uploads. Describe what you see and answer questions about them."
