
# Fix: Display Screenshot Images in Empire Builder Chat

## Problem
When a screenshot feedback is sent to the Architect agent (via "Fix with ARIA" or the autofix flow), the screenshot URL is embedded as plain text in the message content (e.g., `Screenshot: https://...`). The Empire Builder chat renders user messages as plain text only -- images are never visually displayed. This means humans cannot visually audit/check the screenshot.

## Solution
Two changes to `src/pages/EmpireBuilder.tsx`:

### Change 1 -- Store attached file URLs in the message object
When files are attached and sent (line 238-239), store the file URLs in the `Message` object so they can be rendered as images:

```tsx
// Line 239: Add imageUrls to the message
const imageUrls = attachedFiles
  .filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name) || f.url.includes("image"))
  .map(f => f.url);
const userMsg: Message = {
  id: crypto.randomUUID(),
  role: "user",
  content: displayContent,
  timestamp: new Date(),
  files: attachedFiles.map(f => ({ name: f.name, url: f.url, type: "image" })),
};
```

### Change 2 -- Render images inline in user messages
In the message rendering block (lines 546-547), detect image URLs in message content AND render attached file images:

```tsx
{isUser ? (
  <>
    <p className="whitespace-pre-wrap">{message.content}</p>
    {/* Render attached images */}
    {message.files?.filter(f => /image/i.test(f.type || f.name)).map((f, i) => (
      <img key={i} src={f.url} alt={f.name} className="mt-2 rounded-lg max-w-full max-h-64 object-contain" />
    ))}
    {/* Also render any Screenshot: URL found in autofix messages */}
    {(() => {
      const match = message.content.match(/Screenshot:\s*(https?:\/\/\S+)/);
      return match ? <img src={match[1]} alt="Screenshot" className="mt-2 rounded-lg max-w-full max-h-64 object-contain border border-white/10" /> : null;
    })()}
  </>
) : ( ... )}
```

### Change 3 -- Render screenshot in autofix messages
The autofix handler (line 172) includes the screenshot URL as text. The rendering change in Change 2 will automatically detect `Screenshot: https://...` patterns and render them as visible images.

## Technical Details

| File | Change |
|---|---|
| `src/pages/EmpireBuilder.tsx` (lines 238-239) | Store `attachedFiles` in the message's `files` array |
| `src/pages/EmpireBuilder.tsx` (lines 546-547) | Render attached images and auto-detect `Screenshot:` URLs as inline images |

## Result

| Before | After |
|---|---|
| Screenshot URL shown as plain text | Screenshot rendered as a visible, clickable image |
| Humans must copy-paste URL to view | Image visible inline for instant audit |
| Attached images show only "X file(s) attached" text | Attached images displayed visually in the chat bubble |
