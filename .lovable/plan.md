## Goal

Make "remove old/unused code after every fix" a HARD project rule so a fix is permanent — the old behavior cannot reappear because the old code no longer exists.

## Why now

The user memory already captures this for cross-session behavior. Project memory + the bugfix checklist also need to enforce it so CI and future agents/devs can't ship a "fix" that leaves the broken twin alive.

## Deliverables

### 1. New Core memory rule — Dead Code Removal (HARD)
`mem://rules/dead-code-removal` + Core entry in `mem://index.md`:

> **Dead Code Removal (HARD):** After every fix or refactor, delete the replaced/old/unused code in the SAME change: dead branches, unused imports, abandoned helpers, commented-out experiments, duplicate components/hooks/edge functions, stale feature flags, mock data, debug `console.log`. Re-read every touched file to confirm no debris remains. A fix is not done while the old code path still exists — it will be re-imported and the bug will come back.

### 2. Update `docs/engineering/bugfix-checklist.md`
The "Dead code swept" line already exists (item 5). Strengthen it to require an explicit `rg` (ripgrep) search for the removed symbol and a re-read confirmation, and add a "Old code deleted (paths)" line to the closing report.

### 3. Reference from `skill/clean-integration-fix`
That skill already mandates a cleanup pass for plugin/integration work. No change to the skill itself — just cross-link the new memory rule so the same discipline applies project-wide, not only to integrations.

## Order of execution

1. Write `mem://rules/dead-code-removal`
2. Add Core entry + Memories link in `mem://index.md`
3. Strengthen checklist item 5 + add "Old code deleted (paths)" closing-report line in `docs/engineering/bugfix-checklist.md`
4. Verify: re-read all three files

## What I will NOT touch

- Existing business logic, tests, RLS, edge functions
- `client.ts`, `types.ts`, `.env`
- The skill files (only referenced, not edited)

## Risks

None — pure rule + doc change.
