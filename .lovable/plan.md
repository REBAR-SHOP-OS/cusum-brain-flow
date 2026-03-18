

## Plan: Add Two Mode Icons to Pixel Agent Empty State

### What Changes

When user clicks "New chat" for the Pixel agent, instead of auto-sending "Content schedule for today", show two clickable mode cards:

1. **💬 ساخت عکس با چت** (Image creation via chat) — starts a free-form chat where the user describes what they want and the agent generates it directly
2. **📋 ساخت عکس براساس دستور عمل** (Image creation by recipe) — triggers the existing 5-slot content schedule flow (Rebar Stirrups, Rebar Cages, GFRP, Wire Mesh, Rebar Dowels)

### File Changes

**`src/pages/AgentWorkspace.tsx`**

1. Remove the auto-send of "Content schedule for today" from `handleNewChat` (lines 156-159) — no longer auto-trigger the 5-slot flow
2. In the hero/empty state for Pixel (lines 650-698), replace the current greeting + suggestions section with two large clickable cards:
   - Card 1: Chat icon + "ساخت عکس با چت" — does nothing special, just lets user type freely in the input below
   - Card 2: Recipe/list icon + "ساخت عکس براساس دستور عمل" — calls `handleSend("Content schedule for today")` to trigger the 5-slot generation
3. Keep the ChatInput and date display in the hero state so user can still type freely after choosing "chat mode"

### UI Design
- Two cards side by side (or stacked on mobile), centered in the empty state area
- Each card: icon + Persian title + brief description
- Cards use the existing `bg-card border border-border rounded-xl` styling with hover effect
- The date selector remains visible in the top bar

