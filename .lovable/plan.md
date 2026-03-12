

# Add "Approved" Badge Next to "Scheduled" on Calendar Cards

## Problem
When Neel approves a post, there's no visual indicator on the calendar card. Users can't tell which scheduled posts have been approved without opening each one.

## Solution
On line 227 of `SocialCalendar.tsx`, add a check for `firstPost.neel_approved` — when true and status is "scheduled", show "Approved" text next to the status.

### `src/components/social/SocialCalendar.tsx` — Line 227

Change:
```tsx
{status === "published" ? "Published ✅" : status}
```
To:
```tsx
{status === "published" ? "Published ✅" : status}
{status === "scheduled" && firstPost.neel_approved && (
  <span className="text-green-500 font-medium ml-1">· Approved</span>
)}
```

This adds a green "· Approved" label right next to "Scheduled" on calendar cards where Neel has approved the post. Wrapping element (line 220) needs to become a fragment or flex container — it's already inside a flex `div` so the extra `span` will flow naturally.

### Files Changed
- `src/components/social/SocialCalendar.tsx` (1 line change)

