

# Fix: Mid-Day Auto Clock-Out Bug

## Root Cause Analysis

I investigated the database and found the exact problem. Evidence from the data:

```text
User clocks in:  2026-03-19 10:17 UTC (6:17 AM ET)
Auto clock-out:  2026-03-19 12:00 UTC (8:00 AM ET) ← "6 AM morning reset"

User clocks in:  2026-03-17 11:09 UTC (7:09 AM ET)  
Auto clock-out:  2026-03-17 12:00 UTC (8:00 AM ET) ← "6 AM morning reset"
```

This happens EVERY DAY at exactly 12:00 UTC (8:00 AM ET). Users who clock in between 6-8 AM ET get kicked out within 1-2 hours.

**The bug has two parts:**

1. **Something is calling the `auto-clockout` edge function at 12:00 UTC without a body** — there is NO morning cron job in the database, yet the function is being triggered. The function defaults to `mode = "morning"` when the body can't be parsed (line 21-27), so any stray request acts as a full morning reset.

2. **Morning mode has NO time guard** — the function logs a warning if called outside 5-7 AM ET (line 48-50), but proceeds to close ALL shifts anyway. This is a `console.log`, not a `return`.

## Changes

### 1. `supabase/functions/auto-clockout/index.ts` — Add hard time guard

Replace the warning-only log with an actual block that **refuses to execute** morning mode outside the 5-7 AM ET window:

```typescript
if (mode === "morning") {
  // HARD GUARD: only execute between 5-7 AM ET
  if (currentETHour < 5 || currentETHour > 7) {
    console.log(`BLOCKED: morning reset rejected at ET hour ${currentETHour}`);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        blocked: true, 
        message: `Morning reset blocked — current ET hour is ${currentETHour}, only allowed 5-7 AM` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  // ... rest of morning logic
}
```

### 2. Same file — Require explicit mode parameter

Change the default from `"morning"` to `null`, and reject requests with no valid mode:

```typescript
let mode: string | null = null;
try {
  const body = await req.json();
  if (body?.mode) mode = body.mode;
} catch { }

if (!mode || !["morning", "evening"].includes(mode)) {
  return new Response(
    JSON.stringify({ ok: false, error: "Missing or invalid mode. Must be 'morning' or 'evening'." }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

This prevents any stray/accidental HTTP call (health check, deploy warm-up, manual hit) from triggering a mass clock-out.

### 3. Similarly add evening hour guard

Add a guard for evening mode to only run between 5-7 PM ET (17-19), preventing the same class of bug for the evening cron.

## Impact

- No database changes needed
- Only the edge function is modified
- The evening cron job (`0 22 * * 1-5` with `{"mode": "evening"}`) will continue to work correctly at 6 PM ET
- All stray/bodyless calls will be safely rejected with a 400 error

