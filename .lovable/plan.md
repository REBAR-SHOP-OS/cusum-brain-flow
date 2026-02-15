

# Fix "supabase.from(...).insert(...).catch is not a function" Error

## Problem

The `logAction` function (line 774) and `logWpChange` function (line 792) both chain `.catch()` directly on the Supabase insert builder. In the Deno edge function environment with `@supabase/supabase-js@2`, the `PostgrestFilterBuilder` returned by `.insert()` is a thenable but doesn't always expose `.catch()` as a method. This crashes the confirmed-action flow, causing "Action Failed."

## Fix

Wrap both logging calls in try/catch blocks instead of chaining `.catch()`:

### File: `supabase/functions/admin-chat/index.ts`

**logAction (line 773-786):**
```typescript
async function logAction(supabase: any, userId: string, companyId: string, tool: string, args: any, result: any) {
  try {
    await supabase.from("activity_events").insert({
      company_id: companyId,
      entity_type: "jarvis_action",
      entity_id: args?.machine_id || args?.delivery_id || args?.lead_id || args?.cut_plan_id || args?.entity_id || crypto.randomUUID(),
      event_type: `jarvis_${tool}`,
      description: `JARVIS executed: ${tool} -> ${result?.message || "done"}`,
      actor_id: userId,
      actor_type: "jarvis",
      metadata: { tool, args, result },
      source: "system",
      dedupe_key: `jarvis:${tool}:${JSON.stringify(args)}:${new Date().toISOString().slice(0, 16)}`,
    });
  } catch (_) { /* non-critical logging */ }
}
```

**logWpChange (line 788-803):**
```typescript
async function logWpChange(...) {
  try {
    await supabase.from("wp_change_log").insert({
      user_id: userId,
      endpoint,
      method,
      entity_type: entityType,
      entity_id: entityId,
      previous_state: previousState,
      new_state: newState,
      result: errorMsg ? "failed" : "success",
      error_message: errorMsg || null,
    });
  } catch (e: any) {
    console.error("wp_change_log insert error:", e.message);
  }
}
```

Also fix the two `.catch(() => [])` calls on WP client list methods (~line 591-592) by wrapping them in try/catch as well.

## Deployment

Redeploy `admin-chat` edge function after changes.

## Result

Confirmed actions (create event, update order, etc.) will no longer crash on the audit-logging step.

