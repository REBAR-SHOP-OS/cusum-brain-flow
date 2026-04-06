
I audited the current Vizzy voice-time path and found the problem is in the implementation, not your prompt wording.

## What I found

### 1) Vizzy is being asked to “infer” the current time
In `src/hooks/useVizzyVoiceEngine.ts`, the prompt tells the model:

- here is the time at session start
- now calculate current time from elapsed conversation time

That is not deterministic. A realtime model will drift, estimate, or answer differently across retries.

### 2) The prompt contains conflicting time sources
The same instruction block mixes:

- dynamic `CURRENT TIME CONTEXT` based on `timezone`
- hardcoded `America/Toronto` in `REAL-TIME CLOCK`

So Vizzy can receive more than one temporal cue inside the same session.

### 3) The “exact current time at session start” is not fully refreshed
When a session is restarted, `useVizzyVoiceEngine.ts` only regex-replaces:

- `CURRENT TIME CONTEXT`
- `as of ...`

But it does not rebuild the full prompt from scratch, so the critical line:

- `The EXACT current time at session start: ...`

can stay stale in `instructionsRef`.

### 4) Backend “today” logic is still partially timezone-fragile
In `supabase/functions/vizzy-pre-digest/index.ts`, this pattern exists:

```ts
const todayDate = new Date().toLocaleDateString("en-CA", { timeZone: tz });
const todayStart = new Date(`${todayDate}T00:00:00`);
```

That can shift boundaries because the constructed date is not anchored safely to Toronto time. It does not directly answer “what time is it?”, but it injects inconsistent temporal context into Vizzy’s brain.

## Plan to fix it

### A. Make Toronto the single source of truth for Vizzy voice
For Vizzy voice specifically, I will remove mixed timezone behavior and use one authoritative timezone everywhere:

- `America/Toronto`
- one formatter
- one time payload
- one instruction style

### B. Stop asking the model to compute time from elapsed conversation
Instead of:
- “session start time + elapsed time = current time”

I will change Vizzy to receive the authoritative current Toronto time directly.

### C. Rebuild the full instruction payload every time
I will refactor `buildInstructions(...)` so it can rebuild the entire prompt with a fresh `now` value, instead of doing string replacements on old instructions.

That fixes the stale session-start timestamp bug.

### D. Push fresh time into the session while it is live
I will add live time synchronization for the voice session so Vizzy gets updated Toronto time during the conversation, not just once at connect.

Best path:
- refresh on connect
- refresh again when the user finishes speaking
- optionally keep a lightweight periodic refresh while connected

This makes time answers deterministic across repeated tries.

### E. Clean up timezone-safe backend context generation
I will fix the pre-digest/day-boundary logic so all “today” context is computed with Toronto-safe boundaries, preventing conflicting date/time cues from the backend context.

## Files to update

- `src/hooks/useVizzyVoiceEngine.ts`
  - rebuild full instructions with fresh time
  - hard-pin Vizzy voice to Toronto
  - remove “infer elapsed time” behavior
  - add live time sync updates

- `src/hooks/useVoiceEngine.ts`
  - add the hook/event point needed to send a fresh session update right before/around response generation

- `src/lib/dateConfig.ts`
  - centralize the exact Toronto time payload/format used by Vizzy

- `supabase/functions/vizzy-pre-digest/index.ts`
  - replace fragile local-midnight construction with timezone-safe Toronto boundaries

- `supabase/functions/vizzy-daily-brief/index.ts`
  - align time-of-day/greeting logic with the same Toronto-safe approach

## Expected result

After this fix:

- Vizzy will stop giving different times on repeated attempts
- every voice answer will use Toronto time only
- reconnects/restarts will not reuse stale timestamps
- backend context will stop feeding inconsistent time/day signals into the session

## Validation I will use after implementation

1. Start Vizzy, ask for the time immediately
2. Wait 1–2 minutes, ask again in the same session
3. End session, start a new one, ask again
4. Repeat multiple times and compare against Toronto time
5. Confirm no mismatch between greeting, “today” context, and spoken time

## Root cause summary
The main bug is that Vizzy currently relies on prompt-based clock reasoning instead of a deterministic live Toronto clock update. The stale partial prompt refresh makes that even worse.