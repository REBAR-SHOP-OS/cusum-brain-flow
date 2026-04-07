

# Fix: `website-speed-audit` Boot Error

## Root Cause

Vizzy's diagnosis was incorrect. There is **no** `PAGESPEED_API_KEY` referenced anywhere in this function — that was a hallucination. The actual error from the logs is:

```
SyntaxError: Identifier 'baseUrl' has already been declared
```

Lines 84-85 in `supabase/functions/website-speed-audit/index.ts` are identical:
```typescript
const baseUrl = Deno.env.get("WP_BASE_URL")?.replace(...) || "https://rebar.shop";
const baseUrl = Deno.env.get("WP_BASE_URL")?.replace(...) || "https://rebar.shop";  // ← duplicate
```

## Fix

**File:** `supabase/functions/website-speed-audit/index.ts`

Delete line 85 (the duplicate `const baseUrl` declaration). One line removed.

## Impact
- 1 file, 1 line deleted
- Fixes the boot crash immediately — no secrets or API keys needed
- Vizzy's `wp_run_speed_audit` tool starts working again
- No database, UI, or auth changes

