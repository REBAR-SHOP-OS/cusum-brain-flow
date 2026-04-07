

# Block All Agent Access for ai@rebar.shop

## Current State
- **Sidebar**: Already restricted to Kiosk, Shop Floor, Team Hub only
- **IntelligencePanel**: Already blocked (`if (user?.email === "ai@rebar.shop") return null`)
- **FloatingVizzyButton**: Already hidden (only shown for sattar/radin or app builder dashboard)
- **LiveChatWidget**: **NOT blocked** — renders for all users including ai@rebar.shop
- **userAgentMap**: No entry for ai@rebar.shop (good — no quick actions)
- **VizzyBrainPanel**: Already filters ai@rebar.shop from agent sections

## Problem
The `LiveChatWidget` (floating chat panel) has no guard for `ai@rebar.shop`. This user can still open it via the `toggle-live-chat` event and interact with Vizzy agents.

## Changes

### 1. `src/components/layout/LiveChatWidget.tsx`
Add early return for `ai@rebar.shop` — same pattern as IntelligencePanel:
```typescript
const { user } = useAuth();
if (user?.email === "ai@rebar.shop") return null;
```

### 2. `src/components/layout/AppLayout.tsx`
Add a guard so `LiveChatWidget` is not rendered at all for ai@rebar.shop (belt-and-suspenders):
```typescript
{user?.email !== "ai@rebar.shop" && <LiveChatWidget />}
```

Two lines changed across two files. No database changes.

