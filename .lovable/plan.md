

## Fix: Update Sibling Clone Times When Rescheduling

### Problem
When rescheduling an already-scheduled post (changing time/date and clicking Schedule again), the **primary post** gets updated correctly, but its **sibling clones** (same title, other platform×page combos) keep the old time. The duplicate check in the NORMAL flow only looks within the same day — if the new time is on the same day, the clone is skipped (old time remains); if on a different day, a NEW clone is created while the old one stays.

### Solution
In the NORMAL flow of `schedule-post/index.ts`, when `extra_combos` exist:
1. Instead of skip-if-duplicate, **update existing siblings** to the new `scheduled_date`
2. Only **create new clones** if no existing match is found

Also update the primary post's siblings (same title, same user) that aren't in the combos list — update their `scheduled_date` too so ALL cards for this content move together.

### Changes

#### `supabase/functions/schedule-post/index.ts` — NORMAL flow (lines 145-188)

Replace the duplicate-skip logic with update-or-create:

```typescript
for (const combo of extra_combos) {
  // Find existing sibling with same platform + title + page (any date)
  const { data: existing } = await serviceClient
    .from("social_posts")
    .select("id")
    .eq("platform", combo.platform)
    .eq("title", fullPost.title)
    .eq("page_name", combo.page)
    .eq("user_id", fullPost.user_id)
    .neq("id", post_id)
    .limit(1);

  if (existing && existing.length > 0) {
    // UPDATE existing sibling to new date/time
    await serviceClient
      .from("social_posts")
      .update({ scheduled_date, status: "scheduled", qa_status: "scheduled" })
      .eq("id", existing[0].id);
  } else {
    // CREATE new clone
    // (existing insert logic)
  }
}
```

### Files
1. `supabase/functions/schedule-post/index.ts` — Update NORMAL flow to update-or-create siblings

