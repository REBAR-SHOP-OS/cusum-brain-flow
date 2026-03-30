

# Add radin@rebar.shop as Approver

## Change

Add `radin@rebar.shop` to the approval gate check in `PostReviewPanel.tsx` so Radin can also approve posts (alongside neel@rebar.shop and sattar@rebar.shop).

## File: `src/components/social/PostReviewPanel.tsx`

**Line 1065**: Add `radin@rebar.shop` to the condition:
```typescript
// Before
) : (currentUserEmail === "neel@rebar.shop" || currentUserEmail === "sattar@rebar.shop") ? (

// After
) : (currentUserEmail === "neel@rebar.shop" || currentUserEmail === "sattar@rebar.shop" || currentUserEmail === "radin@rebar.shop") ? (
```

Single-line change, no other files affected.

