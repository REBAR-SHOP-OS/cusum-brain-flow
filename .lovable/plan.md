

## Plan: Show 5-Slot Recipe Schedule Table on Card Click

### Current State
The "ساخت عکس براساس دستور عمل" card currently sends `"Content schedule for today"` as a chat message. The user wants it to instead show an interactive schedule table with 5 time slots before entering the chat.

### Slot Data (from existing `PIXEL_SLOTS` in edge function)

| # | Time  | Theme                    | Product              |
|---|-------|--------------------------|----------------------|
| 1 | 06:30 | Motivational / Strength  | Rebar Stirrups       |
| 2 | 07:30 | Creative promotional     | Rebar Cages          |
| 3 | 08:00 | Strength & scale         | Fiberglass Rebar     |
| 4 | 12:30 | Innovation & efficiency  | Wire Mesh            |
| 5 | 14:00 | Product promotional      | Rebar Dowels         |

### Changes — `src/pages/AgentWorkspace.tsx`

1. **Add state**: `showRecipeTable` (boolean, default `false`). Reset to `false` in `handleNewChat`.

2. **Card click**: Instead of `handleSend(...)`, set `showRecipeTable = true`.

3. **Render recipe table**: When `showRecipeTable && !hasConversation`, replace the two cards with a styled table showing the 5 slots. Each row has:
   - Time, Theme, Product columns
   - A "Generate" button per row that calls `handleSend("slot X")` (which triggers the existing slot generation logic)
   - A "Generate All" button at the bottom that calls `handleSend("generate all slots")`
   - A back button to return to card selection

4. Clicking any Generate button sets `showRecipeTable = false` so the chat view takes over naturally.

