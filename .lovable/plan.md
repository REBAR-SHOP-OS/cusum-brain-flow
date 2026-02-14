

# Update JARVIS v1 Plan Document

## What This Does

Update `.lovable/plan.md` to accurately reflect the **already-built** JARVIS v1 system, incorporating the CTO review feedback as future refinements.

## Changes

### File: `.lovable/plan.md` (Rewrite)

Replace the current plan with an accurate post-implementation document that covers:

**Section 1 — Built Infrastructure (Locked)**
- Streaming chat UI (LiveChat.tsx)
- Gemini 3 Pro brain (admin-chat)
- Full business context (vizzyFullContext.ts)
- Memory system (vizzy_memory + save/delete tools)
- ERP write layer (inline in admin-chat, originally from vizzy-erp-action)
- RBAC + audit trail (user_roles, activity_events)
- Proactive daily briefing

**Section 2 — JARVIS v1 Tool Suite (Built)**
Document the 13 tools with their categories:
- Memory: save_memory, delete_memory (immediate)
- Read: list_machines, list_deliveries, list_orders, list_leads, get_stock_levels (immediate)
- Write: update_machine_status, update_delivery_status, update_lead_status, update_cut_plan_status, create_event (confirmation-gated)

**Section 3 — Execution Flow (Built)**
Document the confirmation-first pattern as implemented:
- AI calls write tool -> backend returns pending_action SSE event (not executed)
- Frontend renders Confirmation Card
- User confirms -> POST { confirm_action } -> backend executes + logs
- Result streamed back

**Section 4 — Future Refinements (From CTO Review)**
- Add `requiresConfirmation` metadata per tool definition (instead of relying on WRITE_TOOLS Set)
- Enhance Confirmation Card to show consequence/impact line (e.g., "Machine will be removed from active scheduling")
- Add `original_user_message` and `conversation_id` to audit trail in activity_events
- Entity tracking in conversation state (last_machine_ids, last_delivery_ids) for context-aware follow-ups like "mark that one as down"
- Action outcome echo: structured `action_result` response after confirmed writes
- Risk scoring per action (v2)
- Action simulation / dry-run mode (v2)

**Section 5 — What Will NOT Be Built**
- WebRTC voice / OpenAI Realtime API
- Redis session state
- Microservice architecture
- Wake word detection
- Voiceprint verification

## No Other File Changes

This is a documentation-only update. No code changes.
