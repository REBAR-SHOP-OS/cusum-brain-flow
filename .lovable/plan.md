

# Reliable AI Outbound Calling System

## Overview

This plan introduces a `call_tasks` table as the single source of truth for all AI outbound calls, with idempotency locking, pre-warmed greetings, and echo prevention -- eliminating duplicate calls, double-talking agents, and post-answer delay.

## Database Changes

### New Table: `call_tasks`

```text
call_tasks
+-------------------+----------------------------+
| id                | UUID PK                    |
| company_id        | UUID NOT NULL (FK)         |
| agent_id          | UUID (FK agents)           |
| user_id           | UUID (caller/owner)        |
| contact_name      | TEXT NOT NULL               |
| phone             | TEXT NOT NULL               |
| reason            | TEXT NOT NULL               |
| details           | TEXT                        |
| lead_id           | UUID (nullable FK)         |
| contact_id        | UUID (nullable FK)         |
| status            | TEXT: queued/dialing/in_call/done/failed/canceled |
| outcome           | TEXT: answered/no_answer/voicemail/wrong_number/busy |
| rc_session_id     | TEXT (RingCentral session)  |
| attempt_count     | INT DEFAULT 0              |
| max_attempts      | INT DEFAULT 3              |
| last_attempt_at   | TIMESTAMPTZ                |
| next_attempt_at   | TIMESTAMPTZ                |
| ai_transcript     | JSONB                      |
| notes             | TEXT                        |
| created_at        | TIMESTAMPTZ DEFAULT now()  |
| updated_at        | TIMESTAMPTZ DEFAULT now()  |
+-------------------+----------------------------+
```

- Unique constraint on `(phone, status)` WHERE status IN ('queued','dialing','in_call') to prevent duplicate active calls to the same number.
- RLS: users see own company's tasks; admins see all.
- Validation trigger on `status` and `outcome`.

## Code Changes

### 1. `src/hooks/useCallTask.ts` (NEW)

A hook that wraps the call lifecycle around the `call_tasks` table:

- `createCallTask(data)` -- inserts a row with status `queued`, returns task ID. Checks for existing active task to same phone (idempotency).
- `startCall(taskId)` -- sets status to `dialing`, increments `attempt_count`, calls `webPhoneActions.call()`.
- `onCallConnected(taskId, rcSessionId)` -- sets status to `in_call`, stores `rc_session_id`.
- `completeCall(taskId, outcome, transcript)` -- sets status to `done` with outcome and transcript.
- `failCall(taskId, reason)` -- sets status to `failed`.

### 2. `src/hooks/useCallAiBridge.ts` (MODIFIED)

**Pre-warm greeting** -- generate the ElevenLabs override payload and send the `conversation_initiation_client_data` message immediately on WS open, before any audio. (Already partially done with the 300ms delay, but now formalized.)

**Echo prevention** -- the capture processor (`onaudioprocess`) already captures from the RTCPeerConnection's remote receiver track (caller audio only). The AI output goes to a separate `outputCtx` destination. This architecture already prevents echo since:
- STT input = remote caller audio (16kHz capture context)
- TTS output = separate 48kHz output context to replaced sender track

Add a `muted` flag: while TTS audio is actively playing, temporarily pause sending `user_audio_chunk` to avoid the AI hearing its own voice echoed back by the remote phone system.

**Barge-in** -- when a `user_transcript` event arrives from ElevenLabs (meaning caller started speaking), stop any in-progress TTS playback by disconnecting active `BufferSourceNode`s.

### 3. `src/components/accounting/PennyCallCard.tsx` (MODIFIED)

- Instead of directly calling `webPhoneActions.call()`, it now creates a `call_task` first, then initiates the call through the task lifecycle.
- Show outcome buttons after call ends: "Answered", "No Answer", "Voicemail", "Wrong Number".
- Display attempt count and last attempt time.

### 4. `src/components/accounting/AccountingAgent.tsx` (MODIFIED)

- Wire up `useCallTask` hook alongside existing `useCallAiBridge` and `useWebPhone`.
- On call end, prompt for outcome logging.
- Pass task lifecycle callbacks to `PennyCallCard`.

### 5. `supabase/functions/ai-agent/index.ts` (MODIFIED)

Update Penny's prompt to:
- Check for existing active call tasks before suggesting a new call.
- Include `lead_id` and `contact_id` in `[PENNY-CALL]` tags when available.
- After calls, suggest logging outcome.

### 6. `supabase/functions/ringcentral-webhook/index.ts` (MODIFIED)

When a call event arrives:
- Look up matching `call_tasks` row by phone number + status `dialing`/`in_call`.
- Store `rc_session_id` on the task.
- If session ID already has `bot_started` in task metadata, ignore duplicate webhook events (idempotency).

## Call Flow Sequence

```text
User clicks "Call Now" on PennyCallCard
  |
  v
createCallTask() -> INSERT call_tasks (status: queued)
  |                  [checks no duplicate active task exists]
  v
startCall() -> UPDATE status: dialing, call webPhone.call()
  |
  v
WebPhone "in_call" event fires
  |
  v
onCallConnected() -> UPDATE status: in_call
  |                   store rc_session_id
  v
Auto-trigger AI bridge (existing PennyCallCard logic)
  |
  v
AI bridge sends override -> 300ms delay -> audio streaming begins
  |
  v
Call ends (hangup or remote)
  |
  v
User selects outcome -> completeCall(taskId, outcome, transcript)
  |
  v
UPDATE status: done, outcome, ai_transcript
```

## Expected Results

- **No duplicate calls**: Unique constraint + idempotency check prevents calling same number twice.
- **No double AI**: Single `call_tasks` row = single bridge session. Webhook deduplication via `rc_session_id`.
- **Reduced delay**: Override sent immediately on WS open; 300ms buffer before audio is minimal.
- **Echo prevention**: Separate capture/output AudioContexts + mute-during-playback flag.
- **Barge-in**: Stop TTS playback when caller speaks.
- **Audit trail**: Every call attempt, outcome, and transcript logged in `call_tasks`.

## Technical Notes

- The `call_tasks` table complements (not replaces) `communications` -- `communications` stores the RingCentral record, `call_tasks` stores the AI calling intent and lifecycle.
- The existing `agent_action_log` will also get entries when Penny creates/completes call tasks.
- No changes to the ElevenLabs dashboard are needed beyond the previously discussed "clear First message" step.

