# Bugfix Checklist

Companion to the HARD rule in `mem://rules/bugfix-definition-of-done`. Every bugfix response (agent or human) must end with this block, with each item marked done or explicitly N/A with reason.

## Required items

- [ ] **Repro confirmed before fixing** — recorded the exact failing path / input / route.
- [ ] **Root cause identified** — not the symptom, the underlying helper / hook / edge-function / cache / data shape.
- [ ] **Single code path after fix** — duplicate components / hooks / helpers deleted in the same change.
- [ ] **Regression test added** under `tests/regression/<area>/<name>.test.ts`. Test fails on un-fixed code, passes after.
- [ ] **Dead code swept** — failed-attempt branches, unused imports, debug `console.log`, mock data removed.
- [ ] **Cache purged** (if WordPress / SSH deploy touched) — `scripts/purge-cache.sh` ran and logged.
- [ ] **`mem://` updated** if the bug is class-level (e.g. "always do X, never Y").
- [ ] **Preview re-verified post-fix** — same repro path no longer fails.

## Why these specific items

| Item | Failure mode it prevents |
| --- | --- |
| Repro first | "Fixed" something that wasn't actually broken on that path |
| Root cause | Patched call site, underlying helper still broken — bug reappears in next feature |
| Single path | Two implementations, one fixed — user lands on the unfixed twin |
| Regression test | Next refactor silently re-breaks the same logic |
| Dead code swept | Future dev / AI reads the dead path, copies it, reintroduces the bug |
| Cache purged | Build is fixed, CDN / object cache serves the old broken version |
| `mem://` updated | Pattern repeats in a different feature because no one wrote it down |
| Preview verified | "Fix" was only verified in test environment, broke in real preview |

## When an item is N/A

Mark with a short reason. Examples:

- *Cache purged: N/A — change is Supabase-only, no WordPress / SiteGround surface.*
- *`mem://` updated: N/A — one-off data correction, not a class-level pattern.*
- *Single code path: N/A — only one implementation exists (verified via `rg`).*

## Related infra

- `tests/regression/` — Vitest + Deno tests run on every push.
- `tests/security/no_permissive_policies.sql` — blocks new `USING (true)` / bare-auth RLS.
- `scripts/purge-cache.sh` — deterministic cache flush, called from SSH deploy.
- `.github/workflows/regression.yml` — CI gate.
- `skill/clean-integration-fix` — sibling skill enforcing this same cleanup discipline for plugin / integration work.
