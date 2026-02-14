

# JARVIS v1 -- Brain-to-Hands Upgrade

## Overview

Connect JARVIS's AI brain to ERP actions via tool calling, with a **confirmation-first pattern** for all write operations. Read tools execute immediately. Memory tools execute immediately. Write tools return a `pending_action` to the frontend -- only executing after explicit user confirmation.

```text
User: "Mark Machine 4 as down"
       |
       v
AI calls update_machine_status tool
       |
       v
Backend detects WRITE tool --> returns pending_action SSE event (NOT executed)
       |
       v
Frontend renders Confirmation Card
       |
       v
User clicks [Confirm]
       |
       v
Frontend sends POST { confirm_action: { tool, args } } to admin-chat
       |
       v
Backend executes mutation + logs audit trail (tool, args, result, user_message, timestamp)
       |
       v
AI response streamed back: "Machine 4 marked as down."
```

---

## File Changes

### 1. `supabase/functions/admin-chat/index.ts` (Major rewrite)

**A. Replace MEMORY_TOOLS with JARVIS_TOOLS (13 tools with metadata)**

Each tool gets a `type` field for categorization:

| Tool | Category | Confirmation |
|------|----------|-------------|
| `save_memory` | memory | No |
| `delete_memory` | memory | No |
| `list_machines` | read | No |
| `list_deliveries` | read | No |
| `list_orders` | read | No |
| `list_leads` | read | No |
| `get_stock_levels` | read | No |
| `update_machine_status` | write | Yes |
| `update_delivery_status` | write | Yes |
| `update_lead_status` | write | Yes |
| `update_cut_plan_status` | write | Yes |
| `create_event` | write | Yes |

Write tools are tracked in a `WRITE_TOOLS` Set for detection.

**B. Read tool execution (inline, using existing Supabase client)**

Read tools return structured JSON arrays (not text summaries) so the model can reliably extract IDs for follow-up write calls:

```text
list_machines({ status: "down" })
  --> [{ "id": "uuid", "name": "Machine 4", "status": "down", "type": "cutter" }]
```

The logic mirrors the queries already in `vizzyFullContext.ts` but with filters.

**C. Write tool interception**

When the AI calls a write tool during the normal tool-call flow:
- Do NOT execute the mutation
- Return `"Action queued for confirmation"` as the tool result to the AI
- After the AI follow-up response completes, append a separate SSE event:

```text
event: pending_action
data: {"tool":"update_machine_status","args":{"machine_id":"uuid","status":"down"},"description":"Change Machine 4 status from running to down"}
```

This is a **separate SSE event type** -- not mixed into the `choices[0].delta.content` channel. This prevents race conditions.

**D. Confirmation endpoint (new request path)**

When the request body contains `{ confirm_action: { tool, args } }`:
- Skip AI call entirely
- Server-side admin role check (never trust frontend)
- Execute the write using the same logic from `vizzy-erp-action` (inlined)
- Log to `activity_events` with enhanced audit fields: tool, args, result, original_user_message, conversation context
- Return result as SSE stream so the frontend can display it in chat

**E. System prompt additions**

Add a `TOOL USAGE RULES` section:
- Use read tools to retrieve current entity IDs before performing write operations
- Never assume or hallucinate entity IDs
- For write operations: call the write tool directly -- do not ask for confirmation in text (the system handles confirmation)
- If an entity is ambiguous, ask for clarification before calling a tool
- Prefer tools over explanation when the request is actionable

---

### 2. `src/hooks/useAdminChat.ts` (Moderate changes)

**New state:**
- `pendingAction: PendingAction | null` -- stores `{ tool, args, description }` when a write action needs confirmation

**New SSE parsing:**
- Parse lines starting with `event: pending_action` separately from normal `data:` lines
- When detected, set `pendingAction` state instead of appending to chat content

**New methods:**
- `confirmAction()` -- sends `POST { confirm_action: pendingAction }` to admin-chat, streams the result into chat as an assistant message, clears `pendingAction`
- `cancelAction()` -- clears `pendingAction`, appends a "Cancelled" assistant message

**New type:**
```text
interface PendingAction {
  tool: string;
  args: Record<string, any>;
  description: string;
}
```

---

### 3. `src/pages/LiveChat.tsx` (UI addition)

**Confirmation Card** -- renders above the input area when `pendingAction` is set:

- Uses existing `Card` component
- Amber/yellow left border for visual distinction
- Shows:
  - **Action**: Human-readable tool name (e.g., "Update Machine Status")
  - **Target**: Entity name/ID from args
  - **Change**: Parameter values (e.g., `status -> "down"`)
- Two buttons: `[Cancel]` and `[Confirm Action]`
- Card disappears after either action
- Both buttons disabled during streaming

Tool label map for human-readable names:
```text
update_machine_status  --> "Update Machine Status"
update_delivery_status --> "Update Delivery Status"
update_lead_status     --> "Update Lead Status"
update_cut_plan_status --> "Update Cut Plan Status"
create_event           --> "Log Activity Event"
```

---

## Security Guarantees

- All write tools gated behind server-side admin role check (existing `user_roles` table)
- Write actions NEVER execute on first AI call -- always require explicit user confirmation via separate request
- `confirm_action` endpoint re-validates admin role before executing (never trust frontend)
- Every confirmed action logged to `activity_events` with: tool, params, result, actor_id, timestamp, dedupe_key
- Rate limiting preserved (15 req/60s)
- No raw SQL -- all actions use typed Supabase client queries with validated parameters

## No New Database Tables Needed

All existing tables (`activity_events`, `machines`, `deliveries`, `leads`, `cut_plans`, `inventory_lots`, `work_orders`) already support the required operations.

## Files Summary

| Action | File |
|--------|------|
| Major rewrite | `supabase/functions/admin-chat/index.ts` |
| Moderate update | `src/hooks/useAdminChat.ts` |
| UI addition | `src/pages/LiveChat.tsx` |

