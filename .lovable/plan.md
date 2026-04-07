

# Vizzy Hallucinated Again — No PageSpeed API Key Needed

## The Truth

The `website-speed-audit` edge function **does not call the Google PageSpeed Insights API at all**. It never has. There is no `PAGESPEED_API_KEY` anywhere in the codebase.

Here's what the function actually does:
1. Fetches 3 pages (homepage, shop, blog) directly via `fetch()`
2. Measures TTFB (Time to First Byte)
3. Parses the HTML to count inline styles, scripts, images without lazy loading, render-blocking resources
4. Returns hardcoded WordPress-specific recommendations

**There is no Google API call. There is no API key. There is no "Unauthorized" error from Google.**

## What Happened

Vizzy fabricated the entire narrative:
- Claimed `PAGESPEED_API_KEY` was missing → hallucination (the variable doesn't exist)
- Claimed someone added the key and it resolved the boot error → the boot error was a duplicate `const baseUrl` (already fixed)
- Now claims the key returns "Unauthorized" from Google → there is no Google API call in this function

## What This Draft Should NOT Be Sent

This email to the "App Builder team" asks them to debug a problem that doesn't exist. Sending it would waste everyone's time.

## What To Do Instead

**Option A — Test the function now.** The boot error was already fixed (duplicate variable removed). The function should work. I can curl it to verify.

**Option B — If you want real Google PageSpeed data**, we'd need to add a `PAGESPEED_API_KEY` secret and write new code to call the Google PageSpeed Insights API (`https://www.googleapis.com/pagespeedonline/v5/runPagespeed`). The current function is a self-contained HTML analyzer — it doesn't integrate with Google at all.

## Recommended: Add Anti-Hallucination Rule to Vizzy

Add to `VIZZY_CORE_IDENTITY` in `vizzyIdentity.ts`:

```
═══ NEVER FABRICATE TOOL ERRORS ═══
If a tool returns an error, report the EXACT error message.
Do NOT invent error causes, missing secrets, or API issues.
Do NOT claim a secret exists or was added unless you verified it with a tool call.
Do NOT draft emails about problems you have not confirmed with real data.
If you cannot determine the root cause, say "I don't know the cause" and ask for help.
```

## File Changes

| File | Change |
|------|--------|
| `supabase/functions/_shared/vizzyIdentity.ts` | Add ~8-line anti-fabrication rule to `VIZZY_CORE_IDENTITY` |

## Impact
- 1 file, ~8 lines added
- Prevents Vizzy from inventing error causes and drafting emails about non-existent problems
- No database, UI, or routing changes

