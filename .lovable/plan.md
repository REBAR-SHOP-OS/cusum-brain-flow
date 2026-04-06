

# Vizzy Brain Panel — Real-time System Intelligence & Editable Memory

## Overview

Add a "Brain" icon button to the FloatingVizzyButton menu. Clicking it opens a full panel showing Vizzy's knowledge (from `vizzy_memory` table), lets the user edit/delete entries, and triggers a live system analysis that populates new insights.

## Architecture

```text
FloatingVizzyButton
  ├─ 🎤 Voice (existing)
  ├─ 💬 Chat (existing)
  └─ 🧠 Brain (NEW) → opens VizzyBrainPanel
```

**VizzyBrainPanel** — a slide-in overlay panel (similar to IntelligencePanel) with:

1. **Memory Browser**: Fetches all `vizzy_memory` entries for the user's company, grouped by category (general, benchmark, call_summary, voicemail_summary, agent_audit, auto_fix, etc.). Each entry is editable (content field) and deletable.

2. **Live Analyze Button**: Calls the existing `admin-chat` edge function with a system analysis prompt. The AI response is parsed and saved as new `vizzy_memory` entries (category: `brain_insight`). Results stream into the panel.

3. **Category Tabs/Filters**: Filter memories by category for quick navigation.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/vizzy/VizzyBrainPanel.tsx` | **Create** — Main panel component with memory list, edit, delete, and analyze |
| `src/components/vizzy/FloatingVizzyButton.tsx` | **Modify** — Add Brain icon button to the expanded menu (3rd action button) |
| `src/hooks/useVizzyMemory.ts` | **Create** — Hook to CRUD `vizzy_memory` entries with React Query |

## Implementation Details

### FloatingVizzyButton Changes
- Add a third action button with `Brain` icon from lucide-react
- Position at `{ x: 50, y: -50 }` (opposite of voice button)
- On click: toggle `showBrainPanel` state

### useVizzyMemory Hook
- `useQuery` to fetch all `vizzy_memory` for user's company, ordered by `created_at desc`
- `useMutation` for update (content field) and delete
- `analyzeSystem` function: calls `sendAgentMessage("assistant", "Analyze the entire system...")` or invokes `admin-chat` with a system scan prompt, then inserts results as `vizzy_memory` entries with category `brain_insight`

### VizzyBrainPanel Component
- Full-screen overlay (like VizzyVoiceChat) or side panel
- Header with close button and "Analyze Now" button
- Category filter chips at top
- Scrollable list of memory cards, each showing:
  - Category badge
  - Content (editable textarea on click)
  - Timestamp
  - Delete button
- Loading state during analysis with streaming feel

### Live Analysis Flow
1. User clicks "Analyze Now"
2. Calls edge function with prompt to scan projects, orders, production, financials, emails
3. Response is parsed into individual insight entries
4. Each saved to `vizzy_memory` with category `brain_insight`
5. Panel refreshes to show new insights at top

## No Database Changes
Uses existing `vizzy_memory` table — no migration needed. New category value `brain_insight` is just a string, no enum constraint.

