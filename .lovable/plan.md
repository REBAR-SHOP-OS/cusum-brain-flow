## Goal

Stop the same bugs from coming back by turning today's manual discipline into deterministic, enforced infrastructure — mirroring the RLS guardrail pattern.

## Deliverables

### 1. Core memory rule — Bugfix Definition of Done
`mem://rules/bugfix-definition-of-done` + Core entry in `mem://index.md`:

> **Bugfix DoD (HARD):** A bug is not "fixed" until (a) repro is gone in preview, (b) regression test exists under `tests/regression/`, (c) all duplicate code paths are removed in the same change, (d) cache purged if deploy touches WordPress/SiteGround, (e) class-level cause written to `mem://` if pattern is recurring.

### 2. Regression test scaffold + first tests
Create `tests/regression/` with Vitest + Deno splits:

```text
tests/regression/
├── README.md                          # how to add a regression test
├── quote-engine/
│   └── zero-price-guard.test.ts       # Deno: $0 grand_total must return 422
│   └── missing-inputs.test.ts         # Deno: validate action returns questions
├── access/
│   └── super-admin-whitelist.test.ts  # Vitest: useSuperAdmin gates correctly
│   └── access-overrides.test.ts       # Vitest: useUserAccessOverrides denies by default
├── units/
│   └── mixed-unit-normalization.test.ts  # Vitest: ft+in+mm in same sheet → canonical
│   └── lossless-display.test.ts          # Vitest: source symbol preserved
└── cache/
    └── deploy-purge-marker.test.ts    # Node: asserts purge step ran in last deploy log
```

Wire into existing `vitest.config.ts` (include pattern already covers `src/**/*.test.ts` — extend to `tests/regression/**`).

### 3. Canadian mixed-unit normalization
New helper `src/lib/units/normalizeMixedUnits.ts`:

- Detects per-row unit (`'`, `"`, `mm`, bare) using the same SheetJS `.w` logic already in `import-unit-detection`.
- Adds a **canonical mm value** alongside the lossless display string (does NOT replace it).
- Exposes `<UnitToggle>` in Tags & Export header: Auto / Force ft-in / Force inches / Force mm. Default = Auto (current lossless behavior, no breaking change).
- Solves the "Canada sometimes receives mix of all units" case without violating the lossless mandate in `mem://features/office/import-unit-detection`.

Regression test asserts a fixture sheet with `6'6"`, `49"`, `1524mm` rows all render correctly under each toggle mode.

### 4. Auto cache purge on SSH deploy
New `scripts/purge-cache.sh`:

- Calls SiteGround SuperCacher purge endpoint via authenticated SSH (uses `REBAR_SSH_*` secrets).
- Hits WP REST endpoint to flush object cache + page cache.
- Logs to `.deploy/purge-log.json` with timestamp + commit SHA (consumed by `deploy-purge-marker.test.ts`).
- Wired as the final step of every SSH deploy script in `scripts/` (search and patch every `ssh ... deploy*` invocation).

Replaces the manual `mem://~user` rule with deterministic execution — the user rule stays as the backstop.

### 5. Bugfix checklist doc
`docs/engineering/bugfix-checklist.md` — the human-readable companion to the DoD memory. Referenced from `skill/clean-integration-fix` closing report block:

- [ ] Repro reproduced before fixing
- [ ] Root cause identified (not symptom)
- [ ] Single code path after fix (duplicates deleted)
- [ ] Regression test added under `tests/regression/`
- [ ] Dead code / unused imports swept
- [ ] Cache purged (if WordPress/SSH deploy)
- [ ] `mem://` updated (if recurring class)
- [ ] Preview re-verified post-fix

### 6. GitHub Actions workflow
`.github/workflows/regression.yml` — runs on every push and PR:

```yaml
- vitest run tests/regression
- deno test supabase/functions/quote-engine/
- psql -f tests/security/no_permissive_policies.sql  # existing
- bash scripts/verify-cache-purge-wired.sh           # static check
```

Fails the build on any regression test failure or new permissive RLS policy.

### 7. Research pass — "find root" for recurring debugging
Before shipping the tests, run a focused audit:

- `chat_search` the last ~60 days for repeated user phrases ("again", "still broken", "came back", "same bug").
- Cross-reference with `git log --grep="fix"` frequency per file.
- Output `docs/engineering/recurring-bugs-audit.md` listing the top 5 recurrence hotspots with file paths + suggested regression tests. This informs whether the 4 chosen test areas are actually the highest-leverage ones, or if a 5th should be added.

## Order of execution

1. Research pass (#7) — confirms test priorities
2. Core memory rule (#1) — applies to everything that follows
3. Bugfix checklist doc (#5)
4. Regression scaffold + tests (#2) — quote engine, access, units, cache
5. Mixed-unit normalization helper + UI toggle (#3)
6. Cache-purge script + deploy wiring (#4)
7. GitHub Actions workflow (#6)

## What I will NOT touch

- Existing quote-engine, access-override, or unit-display business logic — only add tests around current behavior.
- The lossless unit display contract — toggle is additive, default unchanged.
- `src/integrations/supabase/client.ts`, `types.ts`, `.env`.
- Any RLS policy (separate workstream, already done).

## Risks

- GitHub Actions requires the project to be GitHub-connected; if it isn't, #6 is scaffolded but inactive until the user connects via Plus menu → GitHub.
- Cache-purge script needs `REBAR_SSH_PRIVATE_KEY` + host/user secrets present; will check via `secrets--fetch_secrets` before wiring.
- Mixed-unit toggle adds UI surface — keeping it in the Tags & Export header only to avoid scope creep.
