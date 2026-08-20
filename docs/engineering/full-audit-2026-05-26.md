# Full Audit — 2026-05-26

Read-only sweep. No code changed. Pick fix batches; each follows Surgical Execution + Bugfix DoD + Post-Change Verification + Dead Code Removal.

## 1. Summary

| Category | Count | Notes |
| --- | ---: | --- |
| TypeScript errors | **0** | `tsc --noEmit` clean ✅ |
| ESLint errors (quiet) | **0 fatal** | exit=2 = config issue; not blocking |
| Vitest failures | **1** | `architectureFlow.test.ts` — real logic bug |
| Vitest infra noise | **12 unhandled** | `canvas.node` missing — env-only, not app bug |
| Edge function 5xx (24h) | **0** | clean |
| Postgres ERROR/FATAL (24h) | **0** | clean |
| Supabase linter findings | **63** | warns: public bucket listing, search_path, leaked-pwd |
| Knip unused files | 2 | edge function test files |
| Knip unused exports | **34** | + 4 unused types |
| Knip unlisted deps | 6 | edge functions importing un-declared npm pkgs |
| `console.log/warn/debug` | **918 calls in 182 files** | debug debris |
| `TODO/FIXME/XXX/HACK` | 6 files | low |
| Migrations total | 539 | RLS surface = wide |
| Frontend LOC | 210,977 | big surface, batch fixes carefully |

## 2. P0 — production-breaking

### 2.1 Failing regression test
- **`src/lib/architectureFlow.test.ts`** — `applyArchitectureLayout (horizontal) > wraps overflow into additional sub-columns with increasing X` is **failing**. Live logic bug in `src/lib/architectureFlow.ts`.
- Fix scope: small (one helper function).

## 3. P1 — HARD-rule violations

These violate Core memory rules. Each is a known recurrence hotspot.

### 3.1 RLS Predicate Standard — 218 violations across 64 migration files
`rg "USING (true)|WITH CHECK (true)|auth.uid() IS NOT NULL|auth.role() = 'authenticated'"` on `supabase/migrations/`.

Top offenders:
- `20260206020024_6ded13b1…sql` — 40 occurrences
- `20260206015949_d83d4f6d…sql` — 12
- `20260210171807_1e2bd343…sql` — 5
- `20260206022034_5aea08e3…sql` — 4
- `20260215165117_bb9fecfd…sql` — 4
- `20260506150444_7c19cdf3…sql` — 4
- `20260207154119_5e15cb80…sql` — 3
- `20260206194737_0147f1e6…sql` — 3
- … 56 more files

**Note**: many are historical migrations — fixing requires NEW migrations replacing the policies, not editing old SQL files. Allowlist genuinely public reads in `docs/security/policy-templates.md`.

Fix scope: medium (one new migration per replacement policy, batched by table).

### 3.2 Frontend Tabs — React.lazy in tab files (HARD)
Per `mem://rules/frontend-development-standards`, `React.lazy` is forbidden in tab components (causes dispatcher crashes).

| File | `lazy()` calls | Tab indicators |
| --- | ---: | ---: |
| `src/pages/AccountingWorkspace.tsx` | **44** | `activeTab` switch routing |
| `src/pages/PipelineIntelligence.tsx` | **15** | 63 `<Tabs>` refs |
| `src/App.tsx` | 10 | route-level lazy (likely OK — verify) |
| `src/pages/Settings.tsx` | 1 | check tab usage |

Fix scope: medium per page. Replace `lazy(() => import(...))` with direct imports.

### 3.3 Session Stability — 90 manual `getUser()` calls across 64 files (HARD)
Per `mem://auth/session-stability`, use `onAuthStateChange` exclusively. Top offenders include hooks (`useCompanyId`, `useNotifications`, `useBudgets`) where each call re-fetches the user.

Fix scope: large — best done as a single sweep extracting a `useCurrentUser()` hook driven by `onAuthStateChange`, then `rg`-replacing call sites.

## 4. P2 — Lint / dead code

### 4.1 Knip — unused exports (34 + 4 types)
Safe to delete after `rg`-confirming zero external uses:
- `src/lib/audioPlayer.ts`: `createPrimedAudio`, `swapAndPlay`
- `src/lib/activityLogger.ts`: `logMutation`, `logEmailSend`, `logAgentInteraction`
- `src/lib/agentRouter.ts`: `routeToAgentSmart`
- `src/lib/dispatchService.ts`: `smartDispatch`
- `src/lib/foremanPlaybook.ts`: `getPlaybookForModule`
- `src/lib/featureFlagService.ts`: `useFeatureFlag`
- `src/lib/gmail.ts`: `fetchGmailMessages`, `parseEmailAddress`, `formatDate`
- `src/lib/cutMath/index.ts`: `weightKg`
- `src/lib/shiftUtils.ts`: `getShiftWindow`
- `src/lib/barlistService.ts`: `logBarlistEvent`
- `src/lib/socialConstants.ts`: `PIXEL_APPROVE_PLATFORMS`
- `src/lib/tax/canadianTaxRates.ts`: `ELIGIBLE_GROSS_UP`, `ELIGIBLE_FED_CREDIT_RATE`, `ELIGIBLE_ON_CREDIT_RATE`
- `src/lib/unitSystem.ts`: `imperialToMetric`, `validBarSizes`, `parseLength`
- `src/lib/userAccessConfig.ts`: `hasMenuAccess`, `hasAgentAccess`, `getUserConfig`
- `src/lib/webrtc/realtimeConnection.ts`: `waitForUsableCandidatesBounded`
- `src/lib/genericSearchParser.ts`: `matchesDateToken`
- `src/lib/chatFileUtils.ts`: `getPublicFileUrl`, `resolveChatFileUrl`
- `src/lib/dateConfig.ts`: `DEFAULT_DATE_FORMAT`, `DEFAULT_TIME_FORMAT`
- `src/lib/architectureGraphData.ts`: `nodesInLayer`, `LAYER_LABELS`
- `src/hooks/useBarlists.ts`: `useBarlistItems`
- `src/hooks/useChatSessions.ts`: `getAgentName`
- `src/hooks/useOrders.ts`: `ORDER_KIND_LABELS`
- `src/contexts/ChatPanelContext.tsx`: `useChatPanel`
- `src/components/social/contentStrategyData.ts`: `getUpcomingEvents`, `getTodaysPillar`
- `src/components/teamhub/teamHubConfig.ts`: `buildRealtimeChannelName`
- `src/components/ad-director/VideoParameters.tsx`: `VideoParameters` (whole component)
- `src/components/chat/AgentSelector.tsx`: `AgentSelector` (whole component)
- `src/components/inbox/EmailActionBar.tsx`: `EmailActionBar` (whole component)
- `src/components/ui/chart.tsx`: `ChartLegend`
- `src/components/ui/dropdown-menu.tsx`: `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuRadioGroup` (likely keep — shadcn surface)
- `src/components/ui/sheet.tsx`: `SheetClose` (likely keep — shadcn surface)
- `src/components/ui/sonner.tsx`: `toast` (likely keep — re-export pattern)
- `src/types/adDirector.ts`: `AVAILABLE_MODELS`, `DEFAULT_MODEL_ROUTES`, `TASK_CATEGORY_MAP`, `DEMO_SCRIPT`
- `src/types/editorSettings.ts`: `DEFAULT_EDITOR_SETTINGS`

Fix scope: small per item.

### 4.2 Knip — unused files (delete after verifying)
- `supabase/functions/autopilot-engine/index.test.ts`
- `supabase/functions/mcp-server/mcp_api_test.ts`

### 4.3 Knip — unlisted dependencies (add to `package.json` or stop importing)
- `supabase/functions/ai-estimate/index.ts` — `npm`
- `supabase/functions/handle-command/index.ts` — `npm`
- `supabase/functions/ingest-historical-barlists/index.ts` — `npm`
- `supabase/functions/ingest-job-logs/index.ts` — `npm`
- `supabase/functions/match-tag-photo/index.ts` — `npm`
- `supabase/functions/mcp-server/index.ts` — `hono`, `mcp-lite`

(Note: these are Deno edge functions; "unlisted" is expected for `npm:` Deno imports. Likely false positive — confirm before action.)

### 4.4 Debug logs — 918 `console.log/warn/debug` calls in 182 files
Top offenders (sweep these first):
- `supabase/functions/ai-agent/index.ts` — 40
- `supabase/functions/extract-manifest/index.ts` — 36
- `supabase/functions/social-publish/index.ts` — 35
- `supabase/functions/social-cron-publish/index.ts` — 35
- `supabase/functions/send-quote-email/index.ts` — 31
- `supabase/functions/ringcentral-sync/index.ts` — 29
- `supabase/functions/regenerate-post/index.ts` — 26
- `supabase/functions/odoo-crm-sync/index.ts` — 23
- `src/lib/backgroundAdDirectorService.ts` — 20

(Many are intentional operational logs — review before mass-delete. Keep `console.error`.)

### 4.5 TODO/FIXME (6 files — review and resolve)
- `supabase/functions/qb-audit/index.ts`
- `supabase/functions/_shared/agents/accounting.ts`
- `src/components/social/contentStrategyData.ts`
- `src/components/shopfloor/MyJobsCard.tsx`
- `src/components/inbox/InboxManagerSettings.tsx`
- `src/components/facebook/FacebookCommenterSettings.tsx`

## 5. Supabase linter — 63 findings

Categories (raw list in `tool-results://supabase--linter/20260526-231323-712227`):
- **Extension in Public** (×2) — non-blocking, move to `extensions` schema if cleaning.
- **Public Bucket Allows Listing** (×10) — review whether public listing is intentional per bucket.
- **Public Can Execute SECURITY DEFINER Function** (×N) — restrict to `authenticated` or `service_role` where appropriate.
- Search path / function hardening — covered by existing HARD rule (`mem://security/database-function-hardening`).

## 6. Production runtime (last 24h)

- **Edge functions:** zero 5xx responses ✅
- **Postgres:** zero ERROR/FATAL/PANIC log lines ✅
- **Cloud status:** `ACTIVE_HEALTHY` ✅

(No live incidents — every P1 below is preventive, not firefighting.)

## 7. Recommended fix batches

Each batch sized to fit one approval turn. Order is priority.

### Batch A — P0 logic bug (15 min)
- Fix `applyArchitectureLayout` horizontal-overflow wrapping in `src/lib/architectureFlow.ts`.
- Add regression case under `tests/regression/` (already in `architectureFlow.test.ts` — make it pass).
- Verify: `bunx vitest run src/lib/architectureFlow.test.ts`.

### Batch B — Frontend `React.lazy` removal (30-45 min)
- `src/pages/AccountingWorkspace.tsx` — 44 lazy → direct imports.
- `src/pages/PipelineIntelligence.tsx` — 15 lazy → direct imports.
- Verify: open both pages in preview, switch tabs, check console.
- Delete lazy fallback/spinner imports if unused (Dead Code Removal).

### Batch C — Knip dead exports (20 min)
- Delete the 34 unused exports + 4 unused types.
- Skip shadcn surface (`SheetClose`, `DropdownMenu*`, `sonner.toast`) — keep for API completeness.
- Delete the 2 unused edge function test files.
- Verify: `bunx tsc --noEmit && bunx knip` (knip count must drop).

### Batch D — `getUser()` → `onAuthStateChange` sweep (45-60 min)
- Centralize in a `useCurrentUser()` hook driven by the auth listener.
- Replace 90 call sites across 64 files.
- Verify: log in / log out cycle in preview; spot-check 3 critical hooks (`useCompanyId`, `useNotifications`, `useBudgets`).

### Batch E — RLS permissive predicate cleanup (multi-session)
- Group by table; one new migration per group replacing `USING (true)` with `is_company_member(company_id)` / `auth.uid() = user_id` / `has_role(...)`.
- Allowlist genuinely public reads in `docs/security/policy-templates.md` + `security_memory`.
- Verify: `tests/security/no_permissive_policies.sql` returns zero rows.
- DO NOT edit historical migration files — only add new ones.

### Batch F — Supabase linter warnings (20 min)
- Restrict bucket SELECT policies that aren't meant to be public.
- Restrict `EXECUTE` on SECURITY DEFINER functions to `authenticated`/`service_role`.
- Verify: `supabase--linter` warn count drops.

### Batch G — Debug log cleanup (per-feature, opt-in)
- Sweep `console.log/warn/debug` in shipped edge functions feature-by-feature when next touching them.
- Keep `console.error`. Replace high-value diagnostics with a single shared logger.
- Don't mass-delete in one go — risk of removing useful prod signals.

## 8. What was NOT touched in this pass

- No code edits.
- No deletes.
- No migrations.
- No deploys.
- `client.ts`, `types.ts`, `.env` untouched.
