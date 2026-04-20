

# Update `GEMINI_API_KEY` secret with the new Google AI Studio key

## What this does
Replaces the existing `GEMINI_API_KEY` runtime secret (used by `supabase/functions/_shared/aiRouter.ts` and every edge function that calls Gemini directly — `extract-manifest`, `ai-estimate`, `ad-director-ai`, `generate-video` fallbacks, etc.) with the freshly-issued key:

```
AIzaSyB_U6a3MKjIvJWEy5MEBo8PLq4805W5e9w
```

This unblocks the AI extraction failures diagnosed in the previous turn (Google AI Studio 429 `RESOURCE_EXHAUSTED`) without redeploying any function — secrets are picked up on the next invocation.

## Steps (after approval)
1. Use the secret-management tool to overwrite `GEMINI_API_KEY` with the new value.
2. Verify by re-running an `extract-manifest` invocation against `Cages.xlsx` and confirming the audit log shows `policy:primary` / `provider:gemini` / HTTP 200 instead of 429.

## Scope
- **Updates:** `GEMINI_API_KEY` runtime secret only.
- **Untouched:** All code, DB, RLS, edge function deployments. The fallback to GPT-5 added previously stays in place as a safety net.

## Security note
The key was shared in plain chat. Recommended: after this rotation works, rotate it once more from Google AI Studio so the value pasted here is no longer valid in the wild. I can re-run this same step with the new value whenever you paste it.

## Validation
- ✅ `extract-manifest` succeeds on Gemini (no fallback triggered)
- ✅ Edge function logs show 200 from `generativelanguage.googleapis.com`
- ✅ No code changes; no deploys required

