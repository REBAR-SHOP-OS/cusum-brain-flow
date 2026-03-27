

# Audit: Social Media Calendar & Manager Status Display Issues

## Issues Found

### Issue 1: Calendar shows "Pending Approval" for approved+scheduled posts
**Location:** `SocialCalendar.tsx` line 246-247
**Bug:** The calendar checks `isApproved` (line 174) using `posts.some(p => p.neel_approved)`. But line 246 shows "Pending Approval" when `status === "scheduled" && !isApproved`. The problem is that when Neel approves via the approval flow (`useSocialApprovals.approvePost`), it sets `neel_approved: true` AND `status: "scheduled"`. But when posts are created via `schedule-post` edge function, they get `status: "scheduled"` with `neel_approved: false` — these correctly show "Pending Approval". However, the `neel_approved` flag may not be updating properly in all approval paths, causing approved posts to still show as pending.

**Fix:** In `SocialCalendar.tsx` line 246, also check `qa_status === "approved"` as a secondary signal:
```typescript
const isApproved = posts.some(p => p.neel_approved || p.qa_status === "approved");
```

### Issue 2: Calendar groups posts by `platform_title` — mixes platforms incorrectly
**Location:** `SocialCalendar.tsx` line 13
**Bug:** `groupByPlatform` uses `${p.platform}_${p.title}` as key. Posts with the same title on different platforms (e.g. Facebook and LinkedIn) get separate groups — this is correct. But posts with the same title on the same platform but different pages get merged into one card showing a single platform icon even though they may be on different pages with different statuses. The `statusSummary` picks the dominant status, hiding minority statuses.

**Fix:** This is cosmetic but can mislead. Add `page_name` to the group key:
```typescript
const key = `${p.platform || "other"}_${p.title || p.id}_${p.page_name || ""}`;
```

### Issue 3: "Pending Approval" tab filter is too broad
**Location:** `SocialMediaManager.tsx` lines 137-142
**Bug:** The pending approval filter shows posts where `!p.neel_approved && status !== "published" && status !== "declined"`. This includes `draft` posts that were never submitted for approval, and `scheduled` posts that haven't been approved. It does NOT exclude `failed` or `publishing` posts either.

**Fix:** Tighten the filter to only show posts actually in the approval pipeline:
```typescript
items = items.filter(
  (p) => !p.neel_approved
    && (p.status === "pending_approval" || p.status === "scheduled")
);
```

### Issue 4: Search filter preserves all scheduled/published posts regardless of query
**Location:** `SocialMediaManager.tsx` lines 150-151
**Bug:** The search filter has `p.status === "scheduled" || p.status === "published" ||` which means searching never hides scheduled or published posts. This defeats the purpose of search.

**Fix:** Remove the status bypass from search:
```typescript
items = items.filter(
  (p) =>
    p.title.toLowerCase().includes(q) ||
    p.content.toLowerCase().includes(q) ||
    p.hashtags.some((h) => h.toLowerCase().includes(q))
);
```

## Summary of File Changes

| File | Issue | Fix |
|------|-------|-----|
| `src/components/social/SocialCalendar.tsx` line 174 | Approved posts show "Pending Approval" | Also check `qa_status === "approved"` |
| `src/components/social/SocialCalendar.tsx` line 13 | Cross-page posts merged incorrectly | Add `page_name` to group key |
| `src/pages/SocialMediaManager.tsx` lines 137-142 | Pending tab shows drafts/failed | Restrict to `pending_approval` or `scheduled` status |
| `src/pages/SocialMediaManager.tsx` lines 150-151 | Search never hides scheduled/published | Remove status bypass from search |

