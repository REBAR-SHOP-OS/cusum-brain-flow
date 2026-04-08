

# Restrict Vizzy Icons to sattar & radin Only

## Problem
The floating Vizzy icons (voice, brain, chat) and the LiveChatWidget are visible to users who should not see them. Only `sattar@rebar.shop` and `radin@rebar.shop` should have access.

## Current State
- **FloatingVizzyButton** (line 90): Already restricted to sattar/radin, BUT has a bypass for `isAppBuilderDashboard` that lets anyone see it on `/app-builder`
- **LiveChatWidget** (line 96): Shows for everyone except `ai@rebar.shop` — needs restriction to sattar/radin only

## Changes

**File: `src/components/layout/AppLayout.tsx`**

1. **Line 90** — Remove the `isAppBuilderDashboard` bypass from FloatingVizzyButton:
```tsx
// Before:
{((user?.email === "sattar@rebar.shop" || user?.email === "radin@rebar.shop") || isAppBuilderDashboard) && <FloatingVizzyButton />}

// After:
{(user?.email === "sattar@rebar.shop" || user?.email === "radin@rebar.shop") && <FloatingVizzyButton />}
```

2. **Line 96** — Restrict LiveChatWidget to sattar/radin only:
```tsx
// Before:
{user?.email !== "ai@rebar.shop" && <LiveChatWidget />}

// After:
{(user?.email === "sattar@rebar.shop" || user?.email === "radin@rebar.shop") && <LiveChatWidget />}
```

## Result
- Only sattar and radin will see the Vizzy floating button cluster and the LiveChat widget
- All other users will have a clean interface without Vizzy icons
- The `/chat` route remains accessible directly if needed (URL-based access is not blocked)

