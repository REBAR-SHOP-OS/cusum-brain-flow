

## Fix: Remove All Unassigned (`?`) Cards After Platform Scheduling

### Root Cause
Two issues cause orphan `?` cards to persist:

1. **Fallback bypass**: When the edge function fails, `schedulePost.ts` falls back to a direct DB update that sets the post to `status: "scheduled"` with `platform: "unassigned"` — creating a scheduled `?` card without deleting it or creating platform clones.

2. **No sibling cleanup**: If auto-generate created multiple unassigned posts with the same title, scheduling one only deletes that single original — sibling unassigned copies remain.

### Fixes

#### 1. `src/lib/schedulePost.ts` — Fix fallback for unassigned posts
When `delete_original` is true and the edge function fails, the fallback should **delete** the post (not update it to scheduled-unassigned). No cloning in fallback — just prevent the orphan.

#### 2. `supabase/functions/schedule-post/index.ts` — Clean up sibling unassigned posts
After cloning for all combos and deleting the original, also delete any OTHER unassigned posts with the **same title** on the **same day**. This catches duplicates from auto-generate or Pixel agent that share the same content.

```text
Unassigned flow (updated):
  1. Clone for all platform×page combos  ✅ (existing)
  2. Delete original unassigned post      ✅ (existing)
  3. Delete sibling unassigned posts       🆕 (same title + same day)
```

### Files to Change
1. `supabase/functions/schedule-post/index.ts` — Add sibling cleanup after original deletion
2. `src/lib/schedulePost.ts` — In fallback: if `delete_original`, delete instead of update

