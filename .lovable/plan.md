## Problem

When a user edits the caption and clicks **Publish Now** before the 1.5s debounced auto-save fires, the published post goes out **without** the new caption.

## Root cause

In `src/components/social/PostReviewPanel.tsx`, the **Publish Now** handler reads from the stale React prop `post.content` (lines 1506 and 1537) instead of the live editor state `localContent`:

```ts
const firstOk = await publishPost({
  id: post.id,
  platform: firstPlatform,
  content: post.content,        // ← stale prop, not the just-typed caption
  title: post.title,            // ← same problem
  hashtags: post.hashtags,      // ← same problem
  ...
});
```

The debounced auto-save (`flushSave`, line 451) only runs ~1.5s after the last keystroke. If Publish Now is clicked before that timer fires, two things happen:
1. The DB row still holds the previous caption.
2. `post.content` (parent-fed prop) is even further behind than the DB row.

`usePublishPost` then strips Persian and sends that stale `content` as `message` to the `social-publish` edge function, so the platform receives the old (or empty) caption.

The sibling handler `handlePlatformsSaveMulti` (line 554) already handles this correctly — it flushes local edits via `updatePost.mutateAsync` and then re-fetches before cloning.

## Fix

In the Publish Now click handler (`src/components/social/PostReviewPanel.tsx`, around lines 1487–1549):

1. **Flush first.** Cancel any pending debounce, build `contentToSave` exactly the way `flushSave` does (`buildPostContent(localContent, persianImageText, persianCaptionText)`), normalize `localHashtags` into the same array shape, and `await updatePost.mutateAsync({ id: post.id, title: localTitle, content: contentToSave, hashtags: hashtagArray })`. Abort publish if the flush throws.
2. **Use live values in the publish payload.** Pass `content: contentToSave`, `title: localTitle`, `hashtags: hashtagArray` to both `publishPost(...)` calls (the first-platform call at line 1503 and the clone-platform call at line 1534). Also use `contentToSave`, `localTitle`, `hashtagArray` in the `createPost.mutateAsync` clone at line 1520 so cloned rows persist the latest caption too.

`usePublishPost.stripPersian` already strips the `---PERSIAN---` / `📝 ترجمه کپشن:` block, so it's safe to pass the full `contentToSave` (which includes the Persian metadata) — the Persian block stays in DB but is removed from the published message.

No backend or edge function changes. No DB migration. Single file edit.

## Verification

1. **Code re-read** the patched `onClick` to confirm `post.content` / `post.title` / `post.hashtags` no longer appear in the publish payload and that `updatePost.mutateAsync` is awaited before `publishPost`.
2. **Regression test** under `tests/regression/social/publish-uses-local-caption.test.ts`: static-source assertion on `src/components/social/PostReviewPanel.tsx` checks that:
   - the Publish Now handler does NOT read `post.content`, `post.title`, or `post.hashtags` when calling `publishPost`,
   - it calls `updatePost.mutateAsync` (flush) before `publishPost` in the same handler.
3. **Browser test**: open `/social-media-manager`, pick an existing draft, type a fresh sentence into the Caption box, immediately click Publish Now without waiting; then check the DB row's `content` via `read_query` to confirm it equals the new caption (the only durable, non-destructive way to prove the flush ran — we won't trigger an actual platform publish; we'll cancel before the edge function returns if needed, or use a post whose platform connection is already known-broken so the publish call exercises the flush path without going live).

## Out of scope

- No change to `usePublishPost`, `social-publish` edge function, or any DB schema.
- No change to the Schedule handler (separate path, separate fix if needed — will be a follow-up if the user reports the same symptom there).
- No change to debounce timing.
