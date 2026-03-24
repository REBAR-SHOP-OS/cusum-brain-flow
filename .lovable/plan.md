

## Fix Reply Quote to Show Images Instead of Raw Links

### Problem
When replying to a message that contains an image, the reply quote displays the raw markdown link (`📎 [image.png](https://...)`) instead of showing a thumbnail preview of the image.

### Changes

**File**: `src/components/teamhub/MessageThread.tsx` (lines 554-568)

Update the reply quote rendering to:
1. Parse the replied message's attachments and inline attachment links using `parseAttachmentLinks` and `fixChatFileUrl`
2. Extract image attachments (from both `repliedMsg.attachments` and parsed markdown links)
3. Show a small thumbnail (`32x32px`, `object-cover`, rounded) for image attachments in the reply quote
4. Show clean text (without the `📎 [file](url)` markdown) as the text preview
5. If the message is only an image with no text, show "📷 Photo" as fallback text

### Files Changed

| File | Change |
|---|---|
| `src/components/teamhub/MessageThread.tsx` | Update reply quote block to render image thumbnails and strip attachment markdown |

