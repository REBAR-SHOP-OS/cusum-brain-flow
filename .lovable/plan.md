

## Show "Pending Approval" / "Scheduled · Approved" on Calendar Cards

### What
Scheduled cards should show **"Pending Approval"** by default, and only show **"Scheduled · Approved"** after `neel_approved` is true (approved by neel@rebar.shop or sattar@rebar.shop).

### Current Behavior
Line 240 shows `statusLabel` (which says "Scheduled" for scheduled posts) and appends "· Approved" only if `neel_approved` is true. But unapproved scheduled cards still say "Scheduled" — they should say "Pending Approval" instead.

### Fix

**File**: `src/components/social/SocialCalendar.tsx` (lines 233-244)

Change the display logic so that for `status === "scheduled"`:
- If `neel_approved` is **false** → show "Pending Approval" in yellow
- If `neel_approved` is **true** → show "Scheduled · Approved" in green

```tsx
// Replace lines 233-244
<span className={cn(
  status === "published" ? "text-green-600 font-medium"
    : status === "scheduled" && firstPost.neel_approved ? "text-green-500 font-medium"
    : status === "scheduled" ? "text-yellow-600"
    : status === "declined" ? "text-destructive"
    : status === "pending_approval" ? "text-yellow-600"
    : "text-muted-foreground"
)}>
  {status === "scheduled" && !firstPost.neel_approved
    ? "Pending Approval"
    : status === "scheduled" && firstPost.neel_approved
    ? "Scheduled · Approved"
    : statusLabel}
</span>
```

Also update card border color (lines 191-192) so unapproved scheduled cards get yellow border:
```tsx
: status === "scheduled" && firstPost.neel_approved
? "bg-card border-green-500/30"
: status === "scheduled"
? "bg-yellow-500/10 border-yellow-500/30"
```

### Files Changed

| File | Change |
|---|---|
| `src/components/social/SocialCalendar.tsx` | Show "Pending Approval" for unapproved scheduled cards, "Scheduled · Approved" for approved ones |

