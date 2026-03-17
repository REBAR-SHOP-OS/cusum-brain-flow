

## Auto-Save All Changes in Post Review Card

### Problem
Currently, editing caption/title/hashtags requires entering a separate "edit mode" and clicking "Save changes." The user expects ALL changes to auto-save immediately — just like the date, content type, platform, and pages fields already do.

### Solution
Remove the edit mode toggle entirely. Make caption, title, and hashtags always-editable with debounced auto-save (800ms after last keystroke).

### Changes — Single File: `src/components/social/PostReviewPanel.tsx`

**1. Remove edit mode entirely**
- Remove `editing`, `editTitle`, `editContent`, `editHashtags` states
- Remove `startEdit()`, `saveEdit()`, `saveEditRef` logic
- Remove the "Save changes" / "Cancel" buttons block
- Remove the "AI Edit" button that triggers `startEdit`

**2. Replace read-only content block with always-editable fields**
- Replace the static `<p>` display of title/content/hashtags with `<Input>` and `<Textarea>` fields that are always visible and editable
- These fields use local state initialized from `post` props

**3. Add debounced auto-save**
- On every keystroke, reset an 800ms debounce timer
- When the timer fires, call `updatePost.mutate({ id, title, content, hashtags })` 
- Show a subtle "Saving..." / "Saved ✓" indicator near the content area
- On panel close or post switch, flush any pending save immediately

**4. Keep existing auto-save for metadata fields**
- Date, content type, platforms, pages already save immediately — no change needed

### Result
Every field in the card auto-saves. No explicit save button needed. User sees "Saved ✓" confirmation. Works whether or not the post is scheduled.

