

## Auto-save Edits on Panel Close

### Problem
When editing caption/title/hashtags in the review panel, closing the panel (`setEditing(false)`) discards unsaved changes. Platform, pages, content type, and date already save immediately — but text edits require a manual "Save" click.

### Solution
Auto-save pending text edits when the panel closes or when the user navigates to a different card.

### Changes

**`src/components/social/PostReviewPanel.tsx`**

1. Extract `saveEdit` logic into a stable ref/callback that can be called from the `Sheet.onOpenChange` handler and from the `post.id` change effect.

2. In the `Sheet onOpenChange` handler (line 344), call `saveEdit()` before `setEditing(false)` if currently editing:
   ```typescript
   onOpenChange={(open) => {
     if (!open) {
       if (editing) saveEdit();  // ← auto-save
       setSubPanel(null);
       onClose();
     }
   }}
   ```

3. Add a `useEffect` that auto-saves when `post.id` changes (user clicks a different card while editing the current one):
   ```typescript
   const prevPostId = useRef(post?.id);
   useEffect(() => {
     if (prevPostId.current && prevPostId.current !== post?.id && editing) {
       // save edits for previous post before switching
       saveEdit();
     }
     prevPostId.current = post?.id;
   }, [post?.id]);
   ```

Single file change, ~10 lines added.

