
# Repo cleanup audit + safe removal plan

Current scan (knip) reports:

- **393 "unused files"** — but **216 of them are `supabase/functions/**`** which knip cannot resolve (Deno entrypoints, cron triggers, runtime `supabase.functions.invoke`). These are **false positives at the static level**.
- **114 unused files inside `src/`** — these are reliable candidates.
- **9 unused npm dependencies + 1 dev dependency**.
- **136 unused exports + 139 unused exported types**.
- **1 duplicate export** in `src/components/teamhub/teamHubConfig.ts`.

The Surgical Execution memory forbids broad destructive refactors. This plan therefore splits the cleanup into **verifiable phases**, each independently revertable, with the high-risk edge-function sweep gated behind explicit confirmation per function.

---

## Phase 1 — Zero-risk cleanups (apply immediately on approval)

These are pure removals with no runtime/behavioral surface.

1. **Unused npm dependencies** (drop from `package.json`, `bun.lockb` regenerates):
   - `@radix-ui/react-aspect-ratio`
   - `@radix-ui/react-context-menu`
   - `@radix-ui/react-hover-card`
   - `@radix-ui/react-menubar`
   - `@radix-ui/react-navigation-menu`
   - `@radix-ui/react-radio-group`
   - `@types/dompurify`
   - `embla-carousel-react`
   - `vaul`
   - dev: `@tailwindcss/typography`

2. **Orphan shadcn/ui wrappers** — never imported anywhere:
   `aspect-ratio.tsx`, `breadcrumb.tsx`, `carousel.tsx`, `context-menu.tsx`, `drawer.tsx`, `hover-card.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `radio-group.tsx`.

3. **Duplicate export** in `src/components/teamhub/teamHubConfig.ts` (`TEAM_HUB_ADMIN_EMAILS | TEAM_HUB_OFFICIAL_WRITER_EMAILS` declared twice).

4. **Empty `src/App.css`** — flagged unused.

Verification: typecheck + build must stay green. No DB or auth surface touched.

---

## Phase 2 — Orphan frontend code (apply per-bucket, each revertable)

114 `src/` files are unreachable from the entry graph. I'll group them so each bucket can be confirmed/rejected independently rather than one giant delete.

| Bucket | Count | Examples |
|---|---|---|
| `components/ad-director/**` (legacy V1) | 19 | `SceneCard`, `StoryboardTimeline`, `editor/*Tab`, `ExportDialog`, `FinalPreview` |
| `components/inbox/**` (unwired panels) | 7 | `ActiveCallsPanel`, `CallDetailView`, `FaxViewer`, `InboxEmailViewer`, `VoicemailPlayer` |
| `components/landing/**` | 6 | `ProductShowcase`, `PublicChatWidget`, `TestimonialSection`, `TrustBadges` |
| `components/empire/**` | 5 | `AIStressTest`, `EmpireBoard`, `VentureDetail` |
| `components/email/**` (legacy mail UI) | 4 | `ComposeEmail`, `EmailList`, `EmailViewer`, `CreateTaskModal` |
| `components/chat/Cal*` | 4 | `CalChatInterface`, `CalChatMessage`, `CalChatThread`, `CalStepProgress` |
| `components/pipeline/Lead*` (legacy) | 6 | `LeadAIPanel`, `LeadActivityTimeline`, `LeadEmailContent/Thread`, `LeadTimeline`, `LeadScoringInsights` |
| `components/layout/{Sidebar,MobileNav,GlobalChatPanel}` (replaced by V2 variants) | 3 | — |
| `lib/serviceLayer/**` (all 7 files orphaned) | 7 | `authService`, `orderService`, `quoteService`, `roleService`, `types`, … |
| `hooks/*` orphans | 11 | `useCommandHandler`, `useCompanies`, `useHumanTasks`, `usePersonalNotes`, `useRCPresence`, `useRenderPipeline`, `useUserAgent`, `useVizzyGeminiVoice`, `useVizzyRealtimeVoice`, `useVoiceEngine`, `usePromptHistory` |
| `types/{machineRun,venture,vizzy}` | 3 | — |
| Misc shopfloor / vizzy / social / nila / admin / settings | ~30 | `InventoryStatusPanel`, `MachineGroupSection`, `OdooDumpImportDialog`, `SettingsPeople`, `VizzyPhotoButton`, `ManualNameFallback`, … |
| `lib/{edgeFunctionInventory,machineRunService,rolloutRegistry,stripe,vizzyContext}` | 5 | — |

**Procedure per bucket:**
1. Re-run knip + a `rg "<basename>"` cross-check to defend against dynamic-import false positives (lazy routes, string-built component names).
2. If clean: delete the bucket's files in one commit; if any file is referenced, skip it and report.
3. Build + typecheck after each bucket.

---

## Phase 3 — Unused exports/types (in-file pruning, not file deletion)

For the 275 unused exports/types inside otherwise-live files:
- Tighten visibility (drop `export` keyword where the symbol is only used internally) or remove the dead declaration.
- Skip exports under `src/integrations/supabase/types.ts` (auto-generated — must not edit).
- Skip exports from `lib/cutMath/*` public surface unless every consumer is gone.

Output: one PR per top-level dir to keep diffs reviewable.

---

## Phase 4 — Edge-function audit (gated, NOT auto-delete)

Knip's 216 "unused" edge functions are mostly false positives. Real test of liveness for `supabase/functions/<name>/`:

1. Frontend `rg "supabase.functions.invoke\\(['\"]<name>"` hits.
2. DB `cron.job` rows referencing `<name>` (query `cron.job` via `supabase--read_query`).
3. External webhooks / `_headers` / docs references.
4. Inter-function `fetch` to `/functions/v1/<name>`.

I will produce a **report only** in this phase: a CSV of every edge function with its liveness signal and a proposed disposition (`keep`, `archive`, `delete`). **No edge function is removed without you approving the report**, because `supabase--delete_edge_functions` is irreversible from the agent side and several functions in this repo are silent cron workers (memory: `Internal Function Protection`, `Workflow Hard Gates`, `Plaid Observer`, `Alert Throttling`, etc.).

Same approach for the 56 `_shared/**` files — kept by default, only removed when no remaining function imports them.

---

## Phase 5 — Guardrails so this doesn't reappear

To stop the same drift returning:

1. **Add `knip.json`** with project-aware config:
   - Mark `supabase/functions/**/index.ts` as entries.
   - Mark `_shared/**` as ignored unless every importer is gone.
   - Whitelist auto-generated `supabase/types.ts`.
2. **Add `bun run lint:dead`** script → `knip --no-progress` with a non-zero exit on new findings.
3. **CI step** (advisory at first, blocking later) runs `lint:dead` on PR.
4. **Memory update**: add a note "Run `bun run lint:dead` before adding a new component that duplicates an existing one" to prevent V1/V2 drift like ad-director, inbox, and Cal chat.

---

## Out of scope (explicitly not touched)

- `src/integrations/supabase/client.ts`, `types.ts`, `.env` — auto-managed.
- `supabase/config.toml` project-level keys.
- RLS / auth / DB schema.
- Any file under memory hard-gates (TimeClock Face-Only, Silent Video, Neel Approval, etc.) even if knip flags an export.

---

## Technical notes

- Tool: `knip` (already runs against bun + tsconfig). No new dep required for the audit itself.
- Verification gates per phase: `bun run build` (the harness handles it) + `bunx vitest run` for impacted test files.
- Every phase lands in its own commit so any single phase can be reverted via History without losing the rest.
- Total expected reduction if all phases land: ~110 src files, ~10 npm packages, ~275 dead exports, plus a documented edge-function map. No behavioral changes.

Approve and I'll execute Phase 1 immediately, then Phase 2 bucket-by-bucket. Phases 4 and 5 will pause for your sign-off on the edge-function report.
