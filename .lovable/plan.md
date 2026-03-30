

# Fix: Page Selection Should Only Apply to Current Platform's Card

## Problem
When user selects pages for a Facebook card, the same pages are also written to the Instagram card (and any other sibling). This is because `handlePagesSaveMulti` updates ALL sibling rows matching `title + scheduled_date`, ignoring platform.

## Root Cause
**`PostReviewPanel.tsx` line 474-476** — the sibling filter matches on `title + scheduled_date` but does NOT filter by `platform`. All cards at the same time slot get the same `page_name`.

## Solution

### File: `src/components/social/PostReviewPanel.tsx`

**Change `handlePagesSaveMulti`** to only update the current post's row (matching its platform), not all siblings:

```typescript
const handlePagesSaveMulti = async (values: string[]) => {
  setLocalPages(values);
  const pagesString = values.join(", ");

  // Only update the CURRENT post row — not siblings on other platforms
  const { error } = await supabase
    .from("social_posts")
    .update({ page_name: pagesString })
    .eq("id", post.id);

  if (error) {
    toast({ title: "Failed to update pages", description: error.message, variant: "destructive" });
  }
  queryClient.invalidateQueries({ queryKey: ["social_posts"] });
  setSubPanel(null);
};
```

## Result
- Selecting pages for a Facebook card only updates that Facebook row
- Instagram card keeps its own independent page selection
- Each platform card maintains separate page assignments

## Files Changed
- `src/components/social/PostReviewPanel.tsx` — scope page update to current post only

