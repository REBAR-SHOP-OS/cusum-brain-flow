

# Fix: Reference Upload Cards Not Clickable

## Root Cause
In `ReferenceUploadCard`, the clickable `<button>` has `className="absolute inset-0 z-0"` but the content div displaying the icon/label has `z-10`, which sits on top of the button and blocks pointer events.

## Fix

### `src/components/ad-director/ChatPromptBar.tsx`

Add `pointer-events-none` to both content containers (the empty state div and the file-preview div) so clicks pass through to the button underneath:

1. **Line 156** — Empty state content div: Add `pointer-events-none`
   ```
   <div className="relative z-10 pointer-events-none flex h-full flex-col justify-between gap-6">
   ```

2. **Line 146** — File preview content div: Add `pointer-events-none`
   ```
   <div className="relative z-10 pointer-events-none flex h-full flex-col justify-end gap-1">
   ```

3. **Line 135** — The "remove" button (X) needs to stay clickable, so add `pointer-events-auto` to it:
   ```
   className="absolute right-3 top-3 z-10 pointer-events-auto flex h-7 w-7 ..."
   ```

4. **Line 133** — The preview image overlay also needs `pointer-events-none`:
   ```
   <img ... className="absolute inset-0 h-full w-full object-cover pointer-events-none" />
   ```

5. **Line 134** — Gradient overlay: add `pointer-events-none`

## Result
Clicking anywhere on the reference cards will trigger the file picker dialog for image upload.

