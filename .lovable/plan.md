

# Add Action Router to Vizzy Voice

## Overview
Create a new edge function `assistant-action` that acts as a single action router, and update `VizzyVoice.tsx` to detect intents and display structured results.

## Files to Change

### 1. NEW: `supabase/functions/assistant-action/index.ts`
A new edge function accepting `{ source, action, params }` and returning `{ ok, spoken, cardTitle, data }`.

Supported actions (source="erp"):
- `get_dashboard_stats` — counts orders, customers, leads, machines, cut plans
- `list_machines` — returns machines list (name, status, type), limit 20
- `list_production_tasks` — returns production_tasks (status, bar_code, task_type, qty), limit 20

Uses `handleRequest` with `authMode: "none"` (matching vizzy-voice pattern). Validates input with Zod. Returns normalized shape.

### 2. EDIT: `src/pages/VizzyVoice.tsx`

**Add intent detection function** — maps transcript text to `{ source, action, params }`:
- "how many orders" / "dashboard" / "stats" → `get_dashboard_stats`
- "show machines" / "machines" → `list_machines`  
- "production tasks" / "show tasks" → `list_production_tasks`
- No match → falls back to existing `vizzy-voice` endpoint

**Modify `sendToVizzy`** — before calling vizzy-voice, check intent. If matched, call `assistant-action` instead. Use the `spoken` field for TTS, store `data` + `cardTitle` in new state.

**Add result panel** — below the reply text area, render a simple card showing `cardTitle` and data (e.g., a small table or stat cards). Minimal styling matching existing design.

**New state**: `actionResult: { cardTitle: string; data: any } | null`

### 3. No other files changed

## Data Flow
```text
User speaks → transcript → detectIntent()
  ├─ intent found → POST assistant-action → { spoken, cardTitle, data }
  │   ├─ TTS speaks "spoken"
  │   └─ UI shows cardTitle + data cards
  └─ no intent → POST vizzy-voice (existing flow, unchanged)
```

## Safety
- Read-only actions only
- No UI redesign — adds a result panel in existing empty space
- Existing voice/audio flow untouched
- Reversible: removing the edge function and intent check restores original behavior

