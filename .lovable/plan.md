
# Fix: Timezone Still Wrong in Vizzy Voice

## What I found
The earlier fix covered some formatting, but there are still two likely reasons Vizzy can speak the wrong time:

1. `useWorkspaceSettings()` and `getWorkspaceTimezone()` both read the first `workspace_settings` row with `.limit(1).maybeSingle()`.
   - If more than one row exists, the app may grab the wrong timezone.
   - That would explain why your screenshot shows Vizzy saying `10:42 AM` while the machine clock shows `7:34 AM`.

2. Vizzy voice has multiple context paths:
   - client prompt in `src/hooks/useVizzyVoiceEngine.ts`
   - pre-digest in `supabase/functions/vizzy-pre-digest/index.ts`
   - daily brief in `supabase/functions/vizzy-daily-brief/index.ts`
   - full raw context in `supabase/functions/_shared/vizzyFullContext.ts`
   These need to use the same timezone source and the same formatter helpers.

## Plan

### 1. Make workspace timezone resolution deterministic
Update both:
- `src/hooks/useWorkspaceSettings.ts`
- `supabase/functions/_shared/getWorkspaceTimezone.ts`

So they do not rely on “first row wins”.
Plan:
- fetch rows ordered consistently (`updated_at desc`)
- use the newest row
- optionally log/warn if more than one row exists

This makes frontend and backend resolve the same timezone every time.

### 2. Centralize Vizzy time formatting
Use the existing `dateConfig.ts` helpers everywhere Vizzy builds spoken or injected time strings.
Apply this to:
- `src/hooks/useVizzyVoiceEngine.ts`
- `src/lib/vizzyContext.ts`
- `supabase/functions/vizzy-daily-brief/index.ts`
- `supabase/functions/vizzy-pre-digest/index.ts`
- `supabase/functions/vizzy-context/index.ts`
- `supabase/functions/_shared/vizzyFullContext.ts`

Goal:
- one timezone source
- one “current local time” calculation
- one “start of day in timezone” calculation

### 3. Fix remaining UTC-based date comparisons in Vizzy backend
I found at least one remaining leak in `supabase/functions/vizzy-context/index.ts`:
- overdue filtering still uses `new Date().toISOString().split("T")[0]`

That should be replaced with the workspace-local date string, otherwise “today/overdue” can drift from the spoken time.

### 4. Make voice session instructions refresh with the confirmed workspace timezone
In `src/hooks/useVizzyVoiceEngine.ts`:
- ensure instructions are rebuilt from the resolved workspace timezone before session start
- ensure fallback brief/pre-digest updates use that same timezone
- keep the prompt wording explicit, e.g. “Use only workspace-local time”

This reduces the chance the model answers from stale initial instructions.

### 5. Add a small validation pass
After implementation, verify:
- changing timezone in Settings affects Vizzy voice immediately
- “What time is it?” matches the selected workspace timezone
- daily brief greeting (`morning/afternoon/evening`) matches the same timezone
- overdue/today data does not shift around midnight

## Files to update
- `src/hooks/useWorkspaceSettings.ts`
- `src/hooks/useVizzyVoiceEngine.ts`
- `src/lib/vizzyContext.ts`
- `supabase/functions/_shared/getWorkspaceTimezone.ts`
- `supabase/functions/vizzy-daily-brief/index.ts`
- `supabase/functions/vizzy-pre-digest/index.ts`
- `supabase/functions/vizzy-context/index.ts`
- `supabase/functions/_shared/vizzyFullContext.ts`

## Expected result
Vizzy should stop answering with mixed UTC/server/browser time and consistently use the selected workspace timezone across voice, digest, brief, and live context.
