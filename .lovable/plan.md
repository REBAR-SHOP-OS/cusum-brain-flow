

# New Agent: Purchasing List ("Kala" — خرید)

## Overview
Create a new **purchasing** agent with a dedicated list-based UI (not just chat). Users can add company items, check them off as purchased, and the list persists in the database with calendar-based history.

## Database

### New table: `purchasing_list_items`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| company_id | uuid FK | |
| title | text | Item name |
| description | text | Optional notes |
| quantity | integer | Default 1 |
| is_purchased | boolean | Default false |
| purchased_by | uuid | Who checked it off |
| purchased_at | timestamptz | When checked |
| due_date | date | Target purchase date |
| priority | text | low/medium/high |
| category | text | Optional grouping |
| created_by | uuid | |
| created_at | timestamptz | |

RLS: company_id-based access for authenticated users.

## Agent Registration (6 files to touch)

1. **`src/lib/agent.ts`** — Add `"purchasing"` to `AgentType` union
2. **`src/components/agent/agentConfigs.ts`** — Add `purchasing` config (name: "Kala", role: "Purchasing & Procurement"). Will reuse `accounting-helper.png` as placeholder image since no dedicated helper exists
3. **`src/lib/agentRouter.ts`** — Add purchasing keywords (buy, purchase, خرید, procurement, shopping list, supplies)
4. **`src/pages/Home.tsx`** — Add Kala to the helpers grid
5. **`supabase/functions/_shared/agentPrompts.ts`** — Import purchasing prompts
6. **`supabase/functions/_shared/agents/operations.ts`** (or new file) — Add purchasing agent system prompt

## Dedicated Purchasing List UI

### New component: `src/components/purchasing/PurchasingListPanel.tsx`
A full-page panel (rendered inside `AgentWorkspace` when `agentId === "purchasing"`) showing:
- **Header**: Title + "Add Item" button + calendar date picker
- **Columnar list**: Each row = item name, quantity, category, due date, checkbox (purchased ✓ / not purchased)
- **Filter tabs**: All | Pending | Purchased
- **Calendar memory**: Pick a date → see what was on the list for that date

### New hook: `src/hooks/usePurchasingList.ts`
- CRUD operations on `purchasing_list_items`
- Realtime subscription for live updates
- Filter by date range and status

### Integration in `AgentWorkspace.tsx`
When `agentId === "purchasing"`, render `PurchasingListPanel` alongside (or instead of) the chat area. The agent chat can still be used to add items via natural language (e.g., "add 50 bags of cement").

## Agent Tools (Edge Function)
Register `list_items`, `add_item`, `toggle_purchased`, `delete_item` tools so the AI agent can manage the list through chat commands too.

## Files Changed

| File | Action |
|------|--------|
| DB migration | Create `purchasing_list_items` table + RLS |
| `src/lib/agent.ts` | Add `"purchasing"` type |
| `src/components/agent/agentConfigs.ts` | Add Kala config |
| `src/lib/agentRouter.ts` | Add purchasing keywords |
| `src/pages/Home.tsx` | Add to helpers grid |
| `src/hooks/usePurchasingList.ts` | New — CRUD + realtime hook |
| `src/components/purchasing/PurchasingListPanel.tsx` | New — list UI with checkboxes + calendar |
| `src/pages/AgentWorkspace.tsx` | Render PurchasingListPanel for purchasing agent |
| `supabase/functions/_shared/agents/operations.ts` | Add purchasing prompt |
| `supabase/functions/_shared/agentPrompts.ts` | Import purchasing prompts |
| `supabase/functions/_shared/agentTools.ts` | Add purchasing tools |
| `supabase/functions/_shared/agentToolExecutor.ts` | Add purchasing tool execution |
| Redeploy `ai-agent` | |

