

# Audit: Social Media Publishing Flow

## Current State

The system has most of the flow correct:
- `social-cron-publish` queries posts where `status = "scheduled"` AND `neel_approved = true` AND `scheduled_date <= now()`
- Duplicate guard checks `title + platform + page_name + date`
- Approval gate blocks unapproved posts

## Issues Found

### Issue 1: Multi-Page Publishing — Only First Page Gets Published (CRITICAL)

`page_name` is stored as comma-separated string (e.g., `"Page1, Page2, Page3"`). Both `social-cron-publish` (line 246) and `social-publish` (line 170) do `pages.find(p => p.name === post.page_name)` — this matches the **entire comma-separated string** against individual page names, so it **never matches** and falls back to the first page only.

**Result**: If a card has 6 pages selected, only the first page in the user's token gets the post. The other 5 pages are silently skipped.

**Fix**: In `social-cron-publish`, split `post.page_name` by `, ` and publish to **each** matched page in a loop. For Instagram, match each page to its linked IG account.

### Issue 2: Duplicate Guard Only Checks Title — Not Content or Image (MEDIUM)

The duplicate guard (cron line 180, publish line 94) checks `title + platform + page_name`. But two posts could have different titles and identical content+image. The user specifically said "same image AND same caption" should be blocked.

**Fix**: Add `content` (or a hash of content) and `image_url` to the duplicate check query.

### Issue 3: Duplicate Guard Uses Full `page_name` String (MEDIUM)

Since `page_name` is comma-separated, the duplicate check `eq("page_name", post.page_name || "")` only catches exact string matches. A post to "Page1, Page2" won't be flagged as duplicate of a post to "Page1, Page2, Page3" even if same content goes to the same actual pages.

**Fix**: When checking duplicates per-page (after splitting), check each individual page name.

### Issue 4: Instagram Cron Publish Doesn't Pass `content_type` (LOW)

`social-cron-publish` line 316 calls `publishToInstagram(matchedIg.id, pageAccessToken, message, post.image_url)` without passing `content_type` or `cover_image_url`. Stories and reels may not publish correctly via cron.

**Fix**: Pass `post.content_type` and `post.cover_image_url` to `publishToInstagram`.

---

## Proposed Changes

### File 1: `supabase/functions/social-cron-publish/index.ts`

**Multi-page loop** (lines 243-320):
- Split `post.page_name` by `, ` to get individual page names
- Loop over each page name, find matching page in token data, publish to each
- For Instagram, match each page to its IG account
- Track per-page success/failure

**Enhanced duplicate guard** (lines 171-194):
- Check `content` and `image_url` in addition to `title`
- Check per individual page name (not full comma-separated string)

**Instagram content_type** (line 316):
- Pass `post.content_type` and `post.cover_image_url` to `publishToInstagram`

### File 2: `supabase/functions/social-publish/index.ts`

**Enhanced duplicate guard** (lines 86-109):
- Add `content` substring match or `image_url` equality to duplicate check
- Split `page_name` and check per-page duplicates

**Multi-page support** (lines 167-174):
- Split `page_name` by `, ` and publish to each matched page in a loop

### File 3: Deploy both edge functions

## Result
- Posts publish to ALL selected pages (not just the first)
- Duplicate detection catches same image+caption across platforms
- Stories/reels publish correctly via cron
- Approval flow (radin/zahra schedule → neel/sattar approve → auto-publish at scheduled time) remains intact

