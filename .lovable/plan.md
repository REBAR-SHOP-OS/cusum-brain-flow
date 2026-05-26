## Goal

After every code change, verify the change is actually applied and working — never declare "done" based on the edit alone.

## Deliverables

### 1. New Core memory rule — Post-Change Verification (HARD)
`mem://rules/post-change-verification` + Core entry in `mem://index.md`:

> **Post-Change Verification (HARD):** After every change, before reporting "done", verify with the fastest relevant signal:
> - **Frontend edit** → re-read the file to confirm the patch landed, then check the preview (browser tool / screenshot / console logs) for the actual rendered behavior.
> - **Edge function** → deploy via `supabase--deploy_edge_functions`, then hit it with `supabase--curl_edge_functions` or `supabase--edge_function_logs`.
> - **DB migration** → run a `supabase--read_query` against the new column/table/policy to confirm it exists and behaves.
> - **Test/regression** → run `bunx vitest run <path>` and confirm pass count.
> - **SSH/WordPress deploy** → run `scripts/purge-cache.sh` and confirm purge log entry.
>
> If the verification signal is unavailable, say so explicitly — never assume success.

### 2. Update `docs/engineering/bugfix-checklist.md`
Add a "Verification signal used" line to the closing-report template so every fix names *how* it was confirmed (file re-read, curl, query, vitest, browser screenshot).

### 3. Wire into GitHub Actions
Already covered — `.github/workflows/regression.yml` runs Vitest + Deno + RLS scan + cache-purge wiring check on every push. No change needed; this rule makes sure the agent doesn't ship without also doing a *local* verification first.

## Order of execution

1. Write `mem://rules/post-change-verification`
2. Update `mem://index.md` Core block
3. Append "Verification signal used" line to `docs/engineering/bugfix-checklist.md`

## What I will NOT touch

- Existing tests, business logic, RLS, edge functions
- `.github/workflows/regression.yml` (already enforces CI side)
- `client.ts`, `types.ts`, `.env`

## Risks

- None — pure rule + doc change.
