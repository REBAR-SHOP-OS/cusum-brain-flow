

## Restrict "Publish Now" to radin@rebar.shop

### Change

**File: `src/components/social/PostReviewPanel.tsx`**

1. Import `useAuth` from `@/lib/auth`
2. Get the current user's email
3. Add a condition to the "Publish Now" button's `disabled` prop: also disable when `email !== "radin@rebar.shop"`
4. Optionally hide the button entirely for other users (or just keep it disabled/greyed out)

Single-file, ~3-line change.

