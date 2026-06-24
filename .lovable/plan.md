Add a small eye icon overlay on the post image preview that opens the stored `image_prompt` in a readable dialog.

### What will change
1. **File: `src/components/social/PostReviewPanel.tsx`**
   - Import `Eye` from `lucide-react`.
   - Add local state `imagePromptOpen` to control the prompt dialog.
   - In the image preview container (the `rounded-lg overflow-hidden bg-muted relative group` block), add a third absolute action button when `post.image_prompt` exists.
     - Position it next to the existing zoom/download buttons, e.g. `top-2 right-20`.
     - Use a small rounded dark button (`bg-black/50 text-white`) with an `Eye` icon, matching the existing zoom/download buttons.
     - Show on hover like the other two (`opacity-0 group-hover:opacity-100 transition-opacity`).
     - `aria-label="View image prompt"` and stop event propagation so the click does not trigger the image zoom.
   - Clicking the eye opens a `Dialog` titled "Image prompt" that displays:
     - The prompt text in a styled `<pre>` block (whitespace-pre-wrap, max-height, scroll, semantic tokens).
     - A "Copy prompt" button that copies the text to the clipboard and shows a toast.
   - Keep the existing collapsible "View image prompt" accordion below the action buttons as a fallback/discovery path; do not remove it.

2. **Styling**
   - Use only semantic Tailwind tokens (`bg-muted/30`, `border-border`, `text-muted-foreground`, `text-foreground`, etc.).
   - No hardcoded colors.

3. **Visibility condition**
   - The eye icon is only rendered if `post.image_prompt` is truthy.
   - For older posts without a stored prompt, the icon remains hidden and the existing accordion will also be hidden.

### Verification
- Re-read the edited file to confirm the icon renders inside the image container and does not break the zoom button.
- Run the project typecheck/build and relevant tests.
- Open a post with a stored `image_prompt` in the preview and confirm the eye icon appears on hover and opens the prompt dialog.