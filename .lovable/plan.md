

## Separate "Set Date" from "Schedule"

### Problem
Currently, the "Set Date" button in the publish date popover calls `schedulePost` which sets `status: "scheduled"` and `qa_status: "scheduled"`. It should only save the date/time without changing the post status. The actual scheduling should only happen via the "Schedule" button at the bottom.

### Changes in `src/components/social/PostReviewPanel.tsx`

1. **Simplify `onSetDate` callback** (lines 478-504): Instead of calling `schedulePost` with status changes, do a direct database update that only sets `scheduled_date` on the post — no status or qa_status change.

```typescript
onSetDate={async (date) => {
  const { error } = await supabase
    .from("social_posts")
    .update({ scheduled_date: date.toISOString() })
    .eq("id", post.id);
  if (error) {
    toast({ title: "Failed to set date", description: error.message, variant: "destructive" });
    return;
  }
  queryClient.invalidateQueries({ queryKey: ["social_posts"] });
  setDatePopoverOpen(false);
  toast({ title: "Date set", description: format(date, "PPP p") });
}}
```

2. **Remove content length check** from the Set Date handler — that validation belongs only to the Schedule button (which already has it).

### Result
- "Set Date" = saves date/time only, post stays in current status (draft/pending)
- "Schedule" button = validates content, platforms, pages, date → calls `schedulePost` with `status: "scheduled"`

