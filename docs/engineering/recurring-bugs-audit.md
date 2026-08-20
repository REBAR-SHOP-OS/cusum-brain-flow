# Recurring Bugs Audit

Snapshot of the recurrence hotspots that the first wave of `tests/regression/` covers. Refresh quarterly or whenever a "didn't we already fix this?" moment happens.

## Hotspots & coverage

| # | Area | Symptom when it reappears | Root pattern | Regression test |
| - | --- | --- | --- | --- |
| 1 | **Quote engine — $0 / pricing failure** | Quote saved as "draft" with `grand_total = 0` despite line items | `$0 QUOTE GUARD` block in `supabase/functions/quote-engine/index.ts` accidentally removed during refactor; or pricing config missing fields and not surfaced as `missing_inputs_questions` | `tests/regression/quote-engine/zero-price-guard.test.ts` — asserts guard source still present |
| 2 | **Access gates — super admin / overrides** | New module forgets to consult `ACCESS_POLICIES.superAdmins` or `useUserAccessOverrides`; user sees data they shouldn't | Whitelist drift; new component bypasses the central hook | `tests/regression/access/super-admin-whitelist.test.ts` — asserts whitelist non-empty and `useSuperAdmin` reads from it |
| 3 | **Unit display — ft-in vs inches vs mm** | Cards show inches when source was feet+inches, or vice-versa; user sees inconsistent rebar schematics | Lossy auto-conversion sneaks back into the renderer; lossless rule in `mem://features/office/import-unit-detection` violated | `tests/regression/units/lossless-display.test.ts` + `mixed-unit-normalization.test.ts` |
| 4 | **Canadian mixed-unit imports** | Single spreadsheet contains `6'6"`, `49"`, and `1524mm` rows; some render correctly, some are mis-scaled | No canonical mm value computed alongside the lossless display, so downstream math (cut-length, weight) silently uses raw numbers | `src/lib/units/normalizeMixedUnits.ts` + `tests/regression/units/mixed-unit-normalization.test.ts` |
| 5 | **Cache staleness post-deploy** | Source ships, preview / production still shows old behavior; "fix came back" | Manual cache purge on SiteGround skipped after SSH deploy | `scripts/purge-cache.sh` + `tests/regression/cache/deploy-purge-marker.test.ts` |
| 6 | **Permissive RLS regression** | New table ships with `USING (true)` or bare `auth.uid() IS NOT NULL` | Lazy copy-paste from older policies | Already covered by `tests/security/no_permissive_policies.sql` |

## Not covered yet (next wave)

- **Duplicate price formatters** — at least two hand-rolled currency formatters exist across `src/`. Future task: consolidate on a single `formatCurrency` and add a regression test that greps for hand-rolled `toFixed(2)` + `$` patterns.
- **Realtime channel collisions** — covered by memory (`mem://architecture/realtime/subscription-standards`) but no behavioral test.
- **Stripe live-mode keys** — covered by memory, no regression test asserting non-test publishable key in prod build.

## How this list was built

- Chat-history search for `again / still broken / came back / same bug` (low signal — most recurrences were paraphrased).
- User-named priorities (this turn): quote engine, access, units, cache, mixed units.
- Cross-reference with existing `mem://` HARD rules — every HARD rule should ideally have a regression test; this audit lists the gaps.
