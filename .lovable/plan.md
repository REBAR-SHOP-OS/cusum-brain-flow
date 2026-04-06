

# Barlist sections closed by default in Station View

## Problem
In the station view (`src/pages/StationView.tsx`), both customer sections and barlist sections auto-expand when they have active work (`defaultOpen={cust.hasActiveWork}` on line 428 and `defaultOpen={bl.hasActiveWork}` on line 452). The user wants **barlists** to always start collapsed.

## Changes

### File: `src/pages/StationView.tsx`

**Line 452** — Change barlist `Collapsible` from:
```tsx
<Collapsible key={bl.planId} defaultOpen={bl.hasActiveWork}>
```
to:
```tsx
<Collapsible key={bl.planId} defaultOpen={false}>
```

Customer sections (line 428) remain unchanged — they still auto-expand based on active work. Only barlists within each project/customer will be closed by default.

## Result
- All barlist sections start collapsed inside each customer group
- Customer groups still auto-expand if they have active work
- Users can manually open any barlist they want to view

