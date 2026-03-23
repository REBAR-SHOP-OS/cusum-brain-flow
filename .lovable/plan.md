

## Equalize Voice & Text Vizzy Capabilities

### Current Gap

Text Vizzy (via `admin-chat`) has **30+ native function-calling tools**. Voice Vizzy uses `[VIZZY-ACTION]` tags — but only **7 action types** are documented in its instructions and handled by the frontend. Voice is missing:

- **Intelligence**: `deep_business_scan`, `investigate_entity`, `auto_diagnose_fix`
- **Memory**: `save_memory`, `delete_memory`
- **Notifications**: `create_notifications`
- **Quotations**: `draft_quotation`
- **ERP Updates**: `update_machine_status`, `update_delivery_status`, `update_lead_status`, `update_cut_plan_status`
- **Events**: `create_event`, `log_fix_request`
- **RC Read**: `rc_create_meeting`, `rc_get_active_calls`, `rc_get_team_presence`, `rc_get_call_analytics`
- **WordPress**: All WP tools
- **QuickBooks**: `quickbooks_query`

### Why Voice Can't Just Get "All Tools"

Voice uses OpenAI Realtime API (`gpt-4o-mini-realtime-preview`) which does **NOT support native function calling**. It can only output text — so we use `[VIZZY-ACTION]` tags that the frontend intercepts and routes to `vizzy-erp-action`. The good news: `vizzy-erp-action` already handles ALL these actions server-side. We just need to:

1. Tell voice Vizzy about them (instructions)
2. Make the frontend execute them (it already does — the handler is generic)

### Plan

#### Change 1: Add all missing action types to voice instructions
**File**: `src/hooks/useVizzyVoiceEngine.ts`

Add these action types to the `VIZZY_INSTRUCTIONS` prompt (alongside existing RC/email/task actions):

```text
═══ FULL ERP ACTION SUITE ═══
You can execute ANY of these via [VIZZY-ACTION] tags:

INTELLIGENCE:
- [VIZZY-ACTION]{"type":"deep_business_scan","date_from":"2026-03-16","date_to":"2026-03-23","focus":"all"}[/VIZZY-ACTION]
- [VIZZY-ACTION]{"type":"investigate_entity","query":"customer name or project"}[/VIZZY-ACTION]

NOTIFICATIONS & REMINDERS:
- [VIZZY-ACTION]{"type":"create_notifications","items":[{"title":"...","description":"...","type":"todo","priority":"high","assigned_to_name":"Neel"}]}[/VIZZY-ACTION]

QUOTATIONS:
- [VIZZY-ACTION]{"type":"draft_quotation","customer_name":"...","items":[{"description":"...","quantity":1,"unit_price":100}]}[/VIZZY-ACTION]

ERP STATUS UPDATES:
- [VIZZY-ACTION]{"type":"update_lead_status","id":"uuid","status":"qualified"}[/VIZZY-ACTION]
- [VIZZY-ACTION]{"type":"update_delivery_status","id":"uuid","status":"in-transit"}[/VIZZY-ACTION]
- [VIZZY-ACTION]{"type":"update_machine_status","id":"uuid","status":"running"}[/VIZZY-ACTION]
- [VIZZY-ACTION]{"type":"update_cut_plan_status","id":"uuid","status":"completed"}[/VIZZY-ACTION]

EVENTS & BUG REPORTS:
- [VIZZY-ACTION]{"type":"create_event","entity_type":"...","event_type":"...","description":"..."}[/VIZZY-ACTION]
- [VIZZY-ACTION]{"type":"log_fix_request","description":"...","affected_area":"..."}[/VIZZY-ACTION]

MEMORY:
- [VIZZY-ACTION]{"type":"save_memory","category":"business","content":"..."}[/VIZZY-ACTION]

RC MEETINGS:
- [VIZZY-ACTION]{"type":"rc_create_meeting","meeting_name":"Team Standup"}[/VIZZY-ACTION]
```

#### Change 2: Update voice action result tracking in frontend
**File**: `src/components/vizzy/VizzyVoiceChat.tsx`

The existing handler already sends ALL action types to `vizzy-erp-action` generically. Just improve the toast summary to recognize the new types:

```typescript
} else if (actionData.type === "create_notifications") {
  results.tasks += actionData.items?.length || 1;
} else if (actionData.type === "draft_quotation") {
  results.other++;
} else if (actionData.type === "deep_business_scan" || actionData.type === "investigate_entity") {
  results.other++;
} else if (actionData.type === "save_memory") {
  results.other++;
```

### Files Changed

| File | Change |
|---|---|
| `src/hooks/useVizzyVoiceEngine.ts` | Add all missing ERP action types to voice instructions |
| `src/components/vizzy/VizzyVoiceChat.tsx` | Improve toast summary for new action types |

### What is NOT Changed
- `admin-chat/index.ts` — text Vizzy already has everything
- `vizzy-erp-action/index.ts` — already handles all action types server-side
- No schema changes
- No new edge functions

