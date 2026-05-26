## Goal

Run a read-only full audit of the repo. Produce one report at `docs/engineering/full-audit-2026-05-26.md` listing bugs, dead code, and HARD-rule violations. No code changes in this pass — user picks fix batches afterward.

## Audit steps (all read-only)

### A. Bugs / regressions
1. `bunx tsc --noEmit` — TypeScript errors, bucketed by file.
2. `bunx eslint . --quiet` — lint errors only.
3. `bunx vitest run` — full test suite, list failures.
4. `supabase--linter` — RLS / search_path / security_definer findings.
5. `supabase--analytics_query` — last 24h `function_edge_logs` where `status_code >= 500`, grouped by function.
6. `supabase--analytics_query` — last 24h `postgres_logs` where `error_severity in ('ERROR','FATAL','PANIC')`.

### B. Dead code
1. `bunx knip` — unused files, exports, dependencies (config already present at `knip.json`).
2. `rg "console\.(log|warn|debug)" src/ supabase/functions/` — debug debris counts.
3. `rg "TODO|FIXME|XXX|HACK" -n` — open todos.
4. Orphan edge functions — list `supabase/functions/*/`, grep frontend for `invoke('<name>')`, report any with zero references.

### C. HARD-rule violations
1. `rg "USING \(true\)|WITH CHECK \(true\)|auth\.uid\(\) IS NOT NULL|auth\.role\(\) = 'authenticated'" supabase/migrations/` — RLS predicate violations.
2. `rg "React\.lazy|lazy\(" src/` cross-referenced with files containing `<Tabs` — React.lazy in tab files.
3. `rg "supabase\.auth\.getUser\(\)" src/` — manual getUser() calls (should use onAuthStateChange).
4. `rg "\.delete\(\)" src/ -A 2 | rg -v "select"` — deletes missing `.select("id")`.

## Deliverable

`docs/engineering/full-audit-2026-05-26.md`:

```text
1. Summary table — counts per category
2. P0 bugs — production-breaking, file:line + suggested fix scope
3. P1 bugs — regression / lint / failing tests
4. Dead code — by category (knip files, debug logs, orphan functions, todos)
5. HARD-rule violations — explicit, grouped by rule
6. Recommended fix batches — small enough each fits one approval turn
```

Plus a 10-line summary printed to chat.

## What I will NOT do

- Fix anything. Audit only.
- Delete files. Only flag candidates.
- Touch `client.ts`, `types.ts`, `.env`.
- Run any migration, deploy, or destructive command.

## Risks

- `tsc`/`eslint`/`vitest`/`knip` may each take 60-180s. Will run in parallel where safe.
- Reports may be large; report summarizes + buckets rather than pasting every line.
- Cloud must be `ACTIVE_HEALTHY` for log pulls — will check first.

## After the audit

User picks fix batches by priority. Each batch follows the HARD rules (Surgical, Bugfix DoD, Post-Change Verification, Dead Code Removal).
