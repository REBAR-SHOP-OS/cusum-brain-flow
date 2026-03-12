
Goal assumed from latest screenshot: remove the recurring “Analysis failed — Request timed out” in Ad Director and ensure the new controls are truly wired (no placeholder behavior).

Plan:
1) Confirm timeout hotspots and remove mixed timeout behavior
- In `AdDirectorContent.tsx`, standardize one timeout constant for the whole analysis pipeline.
- Pass `{ timeoutMs: EDGE_TIMEOUT_MS }` to every `invokeEdgeFunction("ad-director-ai", ...)` call inside `handleAnalyze` (not only the first call), so inner 30s defaults no longer silently abort later stages.

2) Make `ad-director-ai` resilient when tool calls fail
- In `supabase/functions/ad-director-ai/index.ts`, change `callAIAndExtract` retry policy for `analyze-script`:
  - stop doing multiple primary-model retries on malformed tool output;
  - switch to fallback model immediately after first malformed/no-content response;
  - cap total attempts for analyze route to keep response under client timeout.
- Add per-attempt fetch timeout (AbortController) for gateway calls so a single model attempt cannot hang too long.

3) Reduce timeout risk in storyboard analysis
- Keep current structured output, but add a “compact fallback pass” if the primary extraction still fails (smaller output envelope, then normalize server-side) so analysis returns usable storyboard instead of timing out.

4) Fully wire visible video controls (no fake settings)
- `videoParams.ratio` -> pass to `generate-video` `aspectRatio` (replace hardcoded `"16:9"`).
- `videoParams.duration` (+ unit conversion if frames) -> apply as clip duration policy (bounded to provider limits).
- For controls not yet backend-supported (`resolution`, `buildQty`), either wire now where supported or explicitly mark as upcoming/disabled to avoid misleading UI state.

5) Validation (end-to-end)
- Re-run analysis with the same script payload and confirm no timeout toast.
- Verify edge logs no longer show repeated malformed-tool retry loops for analyze route.
- Verify selected ratio/duration actually reach generation payload and affect output behavior.

Technical details:
- Files targeted: `src/components/ad-director/AdDirectorContent.tsx`, `supabase/functions/ad-director-ai/index.ts` (and possibly `supabase/functions/generate-video/index.ts` only if needed for strict resolution/buildQty wiring).
- Non-breaking strategy: localized changes to retry/timeout policy and payload mapping only; no schema migrations required.
