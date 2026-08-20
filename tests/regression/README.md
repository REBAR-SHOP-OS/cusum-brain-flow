# Regression Tests

Pinned tests that fail when a previously-fixed bug comes back. Required by `mem://rules/bugfix-definition-of-done`.

## Layout

```
tests/regression/
├── quote-engine/   # $0 guards, missing-inputs validation, pricing failure paths
├── access/         # super-admin whitelist, access overrides, role gates
├── units/          # lossless display + canonical mm normalization
└── cache/          # post-deploy cache-purge marker verification
```

## How to add a test

1. Reproduce the bug. Capture the failing input / state.
2. Write the smallest possible test that fails on the un-fixed code.
3. Place it under the matching subfolder. Use `<name>.test.ts` (Vitest) or `<name>.deno.test.ts` for Deno-only edge-function tests.
4. Apply the fix. Test should now pass.
5. Update `docs/engineering/recurring-bugs-audit.md` if this is a new hotspot.

## Running

- Vitest: `bunx vitest run tests/regression`
- Deno (edge functions): `deno test --allow-net --allow-env supabase/functions/<name>/`
- CI runs both on every push via `.github/workflows/regression.yml`.

## Rules

- Tests must be deterministic — no network calls to live services, no clocks, no random.
- File-content assertions (e.g. "the `$0 QUOTE GUARD` block must exist in `index.ts`") are valid regression tests — they catch removal-by-refactor.
- One bug = one test. Do not bundle.
