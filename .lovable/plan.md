# JARVIS v1 — Post-Implementation Plan

## Section 1 — Built Infrastructure (Locked)

- **Streaming Chat UI** (`LiveChat.tsx`) — SSE-based real-time chat with markdown rendering
- **Gemini 3 Pro Brain** (`admin-chat` edge function) — tool-calling AI with full business context
- **Business Context** (`vizzyFullContext.ts`) — financials, production, CRM, emails, time clock
- **Memory System** (`vizzy_memory` table + `save_memory`/`delete_memory` tools) — persistent cross-conversation memory
- **ERP Write Layer** (inline in `admin-chat`) — typed Supabase mutations, no raw SQL
- **RBAC + Audit Trail** (`user_roles`, `activity_events`, `command_log`) — admin-only access, rate limiting
- **Proactive Daily Briefing** — scheduled context-aware summary

## Section 2 — JARVIS v1 Tool Suite (Built)

| Tool | Category | Execution |
|------|----------|-----------|
| `save_memory` | Memory | Immediate |
| `delete_memory` | Memory | Immediate |
| `list_machines` | Read | Immediate |
| `list_deliveries` | Read | Immediate |
| `list_orders` | Read | Immediate |
| `list_leads` | Read | Immediate |
| `get_stock_levels` | Read | Immediate |
| `update_machine_status` | Write | Confirmation-gated |
| `update_delivery_status` | Write | Confirmation-gated |
| `update_lead_status` | Write | Confirmation-gated |
| `update_cut_plan_status` | Write | Confirmation-gated |
| `create_event` | Write | Confirmation-gated |

## Section 3 — Execution Flow (Built)

```
User message
  → AI calls write tool
  → Backend returns pending_action SSE event (NOT executed)
  → Frontend renders Confirmation Card
  → User clicks [Confirm]
  → POST { confirm_action } → backend executes mutation + logs to activity_events
  → Result streamed back to chat
```

- Read tools return structured JSON arrays for reliable entity ID extraction
- Write tools never execute on first AI call
- `confirm_action` endpoint re-validates admin role server-side

## Section 4 — Future Refinements (From CTO Review)

- Add `requiresConfirmation` metadata per tool definition (replace `WRITE_TOOLS` Set)
- Enhance Confirmation Card with consequence/impact line (e.g., "Machine will be removed from active scheduling")
- Add `original_user_message` and `conversation_id` to audit trail in `activity_events`
- Entity tracking in conversation state (`last_machine_ids`, `last_delivery_ids`) for context-aware follow-ups like "mark that one as down"
- Action outcome echo: structured `action_result` response after confirmed writes
- Risk scoring per action (v2)
- Action simulation / dry-run mode (v2)

## Section 5 — What Will NOT Be Built

- WebRTC voice / OpenAI Realtime API
- Redis session state
- Microservice architecture
- Wake word detection
- Voiceprint verification
