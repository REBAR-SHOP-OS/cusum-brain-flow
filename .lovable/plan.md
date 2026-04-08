
Goal: permanently eliminate the Vizzy voice startup timeout/no-connection loop by fixing the broken business-context pipeline and making voice connection independent from slow ERP analysis.

What I found:
- The loading text in the screenshot comes from `src/components/vizzy/VizzyVoiceChat.tsx`.
- Voice startup currently does two things at once:
  1. starts the realtime voice/WebRTC session via `useVoiceEngine`
  2. separately fetches heavy business context in `useVizzyVoiceEngine` from `vizzy-pre-digest`, then falls back to `vizzy-daily-brief`
- Root failure is already visible in backend logs:
  - `vizzy-pre-digest` crashes on boot with `Identifier 'result' has already been declared`
  - this happens because `supabase/functions/vizzy-pre-digest/index.ts` declares `const result` twice
- Because pre-digest is broken, the app falls back to `vizzy-daily-brief`, and logs show that fallback takes about 29.9s.
- At the same time, the voice engine has a fixed 20s connect timeout in `src/hooks/useVizzyVoiceEngine.ts`, so users can hit timeout/no-connection even though the slower context flow is still running.
- The heavy shared context builder in `supabase/functions/_shared/vizzyFullContext.ts` also does a very large `Promise.all` across many tables, which makes cold starts and context generation expensive.

Implementation plan:

1. Fix the immediate backend bug in `vizzy-pre-digest`
- Rename the second `result` object near the end of `supabase/functions/vizzy-pre-digest/index.ts`
- Ensure the function boots again and returns cached digest data properly
- This removes the forced fallback path that is currently slowing every session

2. Decouple voice connection from ERP intelligence loading
- Keep the realtime voice session startup fast and independent
- In `src/hooks/useVizzyVoiceEngine.ts`, change the startup flow so voice can connect with lightweight base instructions immediately, while ERP intelligence continues loading in the background
- Prevent background context fetch failures from flipping the whole voice session into a generic connection failure state

3. Make the loading states truthful and separate
- In `src/components/vizzy/VizzyVoiceChat.tsx`, split:
  - voice connection state
  - business-context sync state
- Show “connected, syncing business data” instead of staying in a misleading “connecting/loading ERP intelligence” state
- Keep “connection failed” only for actual token/WebRTC failures

4. Harden the fallback strategy
- If `vizzy-pre-digest` fails, fallback should be fast and bounded
- Reduce dependency on the full `vizzy-daily-brief` path for initial voice readiness
- Prefer cached/stored context first, then refresh in background
- If fresh ERP intelligence is unavailable, keep the session alive with a clear degraded-mode message instead of timing out

5. Reduce backend context-generation cost at the root
- Refactor `supabase/functions/_shared/vizzyFullContext.ts` usage for voice startup:
  - identify which queries are essential for first response
  - defer non-essential sections
  - rely more on cached memory/precomputed daily data where available
- This is the “forever fix” part: smaller startup payload, less cold-start pressure, fewer long-running requests

6. Validate the full startup path
- Verify:
  - `voice-engine-token` still returns quickly
  - `vizzy-pre-digest` boots and returns successfully
  - no forced fallback on every session
  - UI no longer gets stuck on ERP loading
  - no timeout/no-connection loop when backend context is slow

Technical details:
- Affected files:
  - `supabase/functions/vizzy-pre-digest/index.ts`
  - `supabase/functions/_shared/vizzyFullContext.ts`
  - `src/hooks/useVizzyVoiceEngine.ts`
  - `src/components/vizzy/VizzyVoiceChat.tsx`
- Confirmed root cause from logs:
  - `vizzy-pre-digest`: syntax boot failure
  - `vizzy-daily-brief`: succeeds but too slow for startup-critical path
- Core architectural fix:
```text
Current:
Open voice -> connect voice + fetch heavy ERP context -> pre-digest broken -> slow fallback -> timeout/no connection

Target:
Open voice -> connect voice immediately -> load cached/light ERP context -> refresh richer ERP intelligence in background -> update session instructions live
```
