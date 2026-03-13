

# Add Reference Image Upload to Image Edit Dialog

## What
Add a button next to the prompt input in `ImageEditDialog` that lets users upload a reference image. This reference image will be sent alongside the edit request so Nano Banana can use it as visual inspiration.

## Changes

### 1. `src/components/social/ImageEditDialog.tsx`
- Add state: `referenceImage` (string | null) and a hidden file input ref
- Add an upload button (ImagePlus icon) next to the prompt input — when clicked, opens file picker
- When file selected, convert to base64 data URL and store in state
- Show a small thumbnail preview with remove button when reference is set
- Pass `referenceImage` in the `invokeEdgeFunction` call as a new field
- Reset `referenceImage` when dialog opens

### 2. `supabase/functions/generate-image/index.ts`
- In the edit mode block (line ~150), read `referenceImage` from request body
- If present, add it as a second `image_url` content part in the messages array sent to Gemini
- Update the edit prompt to mention: "Use the additional reference image as visual inspiration for the edit"

## Layout (prompt row)
```text
[ 🖼 ] [ Describe the edit...________________ ] [ Apply ]
  ↑ upload ref
```
If reference uploaded, show small thumbnail below with ✕ to remove.

