

# Make Vizzy Brain Strictly Read-Only Monitoring

## Problem
The Vizzy Brain panel currently allows editing and deleting memory entries (pencil/trash icons on each card). The user has clarified this panel is **strictly for monitoring and reporting** — no CRUD operations. The Vizzy agent should use this data as its knowledge base when responding.

## Changes

### 1. Remove Edit/Delete from MemoryCard (`src/components/vizzy/VizzyBrainPanel.tsx`)

- Remove the `onUpdate` and `onDelete` props from `MemoryCard`
- Remove the pencil (edit) and trash (delete) icon buttons
- Remove the editing state, draft state, and save logic
- Make the card a pure read-only display: timestamp + content
- Also remove `onUpdate`/`onDelete` from `DateGroupedEntries` component
- Remove the corresponding prop-passing where these components are used

### 2. Ensure Vizzy Agent References Brain Data (`supabase/functions/_shared/vizzyFullContext.ts`)

- Verify that the `vizzy_memory` data is already loaded into the agent's context (it is — line ~190 loads all memory entries)
- No change needed here — the agent already queries `vizzy_memory` as part of its context building

### 3. Keep "Analyze Now" Button

- The "Analyze Now" button triggers AI analysis that **writes** new monitoring data — this is an ingestion action, not user-editing, so it stays

## Result
The Brain panel becomes a clean, read-only monitoring dashboard. Memory cards show content without any edit/delete controls. The Vizzy agent continues to reference all brain memory when answering.

## Files Changed
- `src/components/vizzy/VizzyBrainPanel.tsx` — remove edit/delete UI from MemoryCard and DateGroupedEntries

