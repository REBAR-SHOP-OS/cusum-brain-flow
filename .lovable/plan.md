

# Restrict Vizzy to Super Admin + Add RingCentral Access

## What Changes

1. **Vizzy visible only to you (sattar@rebar.shop)** — other users won't see Vizzy in the agent grid, can't access `/vizzy`, and won't see the voice chat icon
2. **Remove voice chat icon from all agent chat rooms** for everyone except you
3. **Give Vizzy RingCentral access** to make calls and send SMS on your behalf

## Scope Guarantee
- No changes to PIXEL or any other agent's logic/UI
- Only Vizzy-related visibility and RingCentral integration

---

## File Changes

### 1. `src/pages/Home.tsx`
- Filter the `helpers` array: hide the "assistant" (Vizzy) card unless user is super admin
- Only pass `onLiveChatClick` to `ChatInput` if user is super admin

### 2. `src/pages/AgentWorkspace.tsx`
- Only pass `onLiveChatClick` to `ChatInput` if user is super admin
- If `agentId === "assistant"` and user is NOT super admin, redirect away

### 3. `src/pages/VizzyPage.tsx`
- Add super admin guard: if not `sattar@rebar.shop`, redirect to `/home`

### 4. `supabase/functions/ai-agent/index.ts`
- Add RingCentral tools to Vizzy's system prompt so she knows she can make calls/send SMS
- When Vizzy decides to call or SMS, return a structured action the frontend can execute

### 5. `supabase/functions/ringcentral-action/index.ts` (NEW)
- New edge function that Vizzy can trigger to:
  - **Make a call** via RingCentral API (using the super admin's stored OAuth token)
  - **Send an SMS** via RingCentral API
- Uses existing `user_ringcentral_tokens` table for auth
- Requires human confirmation before executing (safety rule)

---

## Technical Details

### Vizzy Visibility Guard
```text
useSuperAdmin() hook (already exists) returns { isSuperAdmin }
- Home.tsx: filter helpers list, conditionally show voice icon
- AgentWorkspace.tsx: conditionally show voice icon, block /agent/assistant
- VizzyPage.tsx: redirect non-super-admin users
```

### RingCentral Integration Flow
```text
CEO asks Vizzy: "Call John at 416-555-1234"
  -> Vizzy returns structured action: { type: "ringcentral_call", phone: "4165551234" }
  -> Frontend shows confirmation dialog: "Vizzy wants to call 416-555-1234. Approve?"
  -> On approval, calls ringcentral-action edge function
  -> Edge function uses CEO's RC OAuth token to initiate the call/SMS
```

### RingCentral API Endpoints Used
- **Make call**: `POST /restapi/v1.0/account/~/telephony/sessions` (RingOut)
- **Send SMS**: `POST /restapi/v1.0/account/~/extension/~/sms`

### Safety
- All RingCentral actions require explicit user confirmation (click to approve)
- Only super admin's RC token is used
- No other agents gain any new capabilities
