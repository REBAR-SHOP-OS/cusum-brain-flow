

## Plan: Fix Rapid-Click Race Conditions on All Pixel Social Buttons

### Problem
Multiple destructive/important buttons in the social module lack proper double-click protection. Rapid clicking can trigger duplicate API calls before React state updates disable the button.

### Vulnerable Buttons Found

| Component | Button | Current Protection | Risk |
|-----------|--------|-------------------|------|
| `PixelPostCard` | Approve | `if (!approved)` check only | Double approve before state update |
| `PixelPostCard` | Regenerate | `regenerating` state | Minor — already guarded |
| `PostReviewPanel` | Schedule | None | Double-schedule, duplicate posts |
| `PostReviewPanel` | Delete | `disabled={deleting}` only | No confirm dialog — accidental delete |
| `PostReviewPanel` | Publish Now | ✅ Already fixed | — |
| `ApprovalsPanel` | Approve/Reject | `isPending` from mutation | Minor — React Query handles it |

### Changes

**File 1: `src/components/social/PixelPostCard.tsx`**
- Add a `processing` ref guard to `handleApprove` to block rapid double-clicks before React re-renders
- Disable the Approve button while processing (`disabled={approved}`)

**File 2: `src/components/social/PostReviewPanel.tsx`**
- **Schedule button**: Add `scheduling` state + `disabled={scheduling}` to prevent double-schedule
- **Delete button**: Add `window.confirm("Are you sure you want to delete this post?")` before executing

### What stays the same
- Publish Now — already fixed
- All API logic, edge function calls, data flow — unchanged
- ApprovalsPanel — React Query `isPending` is sufficient

