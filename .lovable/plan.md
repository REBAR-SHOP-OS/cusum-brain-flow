

## Fix: Persian Translation Section — Always Visible, Never Editable, Never Published

### Problem
1. `localContent` is initialized from `post.content` which includes the `---PERSIAN---` block — so Persian text appears inside the editable Caption textarea and can accidentally be published
2. The Persian reference section only renders when `---PERSIAN---` exists in content — but it should always be a clearly separated, read-only section
3. When auto-save fires, it saves `localContent` (including Persian) back to DB, perpetuating the cycle

### Plan

**File: `src/components/social/PostReviewPanel.tsx`**

1. **Strip Persian from `localContent` on init** (lines 206-207):
   - Parse `post.content` to extract the Persian block
   - Set `localContent` to only the English portion (before `---PERSIAN---`)
   - Store Persian parts separately in state: `persianImageText` and `persianCaptionTranslation`

2. **Preserve Persian in DB but strip from editable field**:
   - In `flushSave` (line 276-277), when saving content back, re-append the stored Persian block so it's not lost from the DB record
   - This way: editable textarea = English only, DB = full content with Persian preserved

3. **Make Persian section always visible (not collapsible)**:
   - Replace the current collapsible section (lines 604-627) with an always-visible read-only box similar to `PixelPostCard`
   - Show "🖼️ Image text" and "📝 Caption translation" fields
   - Label it clearly: "🔒 Internal reference only — not published"
   - Show "No translation available" placeholder when empty
   - RTL direction for Persian text

4. **Ensure publish/schedule never includes Persian**:
   - `usePublishPost.ts` already has `stripPersian()` — verified safe
   - `schedule-post` edge function uses `stripPersianBlock()` — verified safe
   - The auto-save will preserve the full content in DB (with Persian), but the publish path strips it

### Files to Change
- `src/components/social/PostReviewPanel.tsx` — all 4 changes above

