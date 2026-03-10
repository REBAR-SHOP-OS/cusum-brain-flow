

# Fix: Extract Still Using Old Model — Deployment Stale + Truncation

## Root Cause

The edge function logs confirm the **deployed** version is still the old code:

```
Using model: gemini-2.5-flash for file: 23 HALFORD ROAD...
Initial JSON parse failed, attempting truncation repair...
Repaired truncated JSON: recovered 24 items
```

The code was updated to use `gemini-2.5-pro` with `65000` max tokens, but the function **was not successfully redeployed** — it's still running `gemini-2.5-flash` with the old token limit, causing truncation at 24 of 89 rows.

## Fix

### 1. Redeploy `extract-manifest`

Force redeployment so the production function matches the source code (pro model + 65k tokens).

### 2. Add `finish_reason` detection

After the AI call, check if the response was truncated (`finish_reason === "length"` or `"MAX_TOKENS"`) and log it explicitly. This makes future debugging faster.

### 3. Improve JSON truncation recovery

The current repair logic only handles one truncation pattern. Add a more robust recovery that tries multiple repair strategies before giving up.

### Expected Result

- Spreadsheets use `gemini-2.5-pro` with 65k token output limit
- 89-row files extract completely without truncation
- If truncation still occurs, better recovery and clear warnings

