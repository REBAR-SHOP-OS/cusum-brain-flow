

# Add AI Image Editor with Drawing Mask

## Concept
A new dialog (`ImageEditDialog`) that lets users:
1. See the current post image on a canvas
2. Draw/paint over areas they want to change (red semi-transparent brush strokes)
3. Type a prompt describing the desired edit
4. Send the annotated image (with drawn marks visible) + prompt to Gemini image editing API
5. Receive back the edited image with the rest preserved

## Approach
Since Gemini's image editing works by sending an image + text instruction (not traditional inpainting masks), we'll render the user's brush strokes as visible red highlights on the image, then send that composite image to Gemini with the instruction: "Edit ONLY the areas marked in red according to the user's prompt. Preserve everything else exactly."

## Files

### 1. New: `src/components/social/ImageEditDialog.tsx`
- Full-screen dialog with:
  - Canvas overlay on top of the post image for drawing
  - Brush size slider (small/medium/large)
  - Clear drawing button
  - Undo last stroke
  - Text prompt input
  - "Apply Edit" button
- Drawing: HTML Canvas with mouse/touch event handlers, red semi-transparent strokes
- On submit:
  - Composite the drawing onto the image using a temp canvas
  - Convert to base64
  - Call `generate-image` edge function with the image + edit prompt using Gemini's image editing capability (multimodal input)
  - Return edited image via `onImageReady` callback

### 2. Edit: `src/components/social/PostReviewPanel.tsx`
- Add `showImageEdit` state
- Add "Edit Image" button (with `Pencil` icon) in the button grid row
- Import and render `ImageEditDialog`, passing `post.image_url` and `handleMediaReady`
- Button only visible when image exists (not video)

### 3. Edit: `supabase/functions/generate-image/index.ts`
- Add support for an `editImage` parameter (base64 data URL)
- When `editImage` is provided, send it as multimodal content to Gemini along with the prompt, using the image editing pattern (text + image_url in messages)
- The prompt will instruct: "Edit only the areas marked with red highlights. Keep everything else identical."

## Technical Detail

```text
User flow:
  Click "Edit Image" → Dialog opens with canvas over image
  → Draw red marks on areas to edit → Type prompt → Click "Apply"
  → Canvas composites marks onto image → base64 sent to edge function
  → Gemini receives annotated image + instruction → Returns edited image
  → Image saved to post via handleMediaReady
```

Canvas drawing uses standard HTML5 Canvas API with `mousedown/mousemove/mouseup` and `touchstart/touchmove/touchend` for mobile support. Strokes stored as arrays of points for undo capability.

