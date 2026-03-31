

# Revised Marketing & Content Module Blueprint — Correction Pass

## Objective
Perform a strict correction and hardening pass on the existing `Marketing_Content_Module_Blueprint.pdf`, fixing all gaps, mismatches, omissions, and contradictions against the real REBAR SHOP OS codebase.

## Correction Summary (Issues Found → Fixed)

### A. Module Boundary Errors
1. **SEO was silently merged** — SEO pages (`SeoModule`), 12+ SEO edge functions (`seo-ai-*`, `seo-site-crawl`, etc.), and SEO agent (`Seomi`) belong to **Website / SEO module** in the original architecture. Will be reclassified as "Cross-Module Integration" with clear separation.
2. **FacebookCommenter page missing** — Route `/facebook-commenter` with `AdminRoute` guard exists in App.tsx but was omitted from the blueprint. Will be restored.
3. **DailySummarizer omitted** — `/daily-summarizer` route exists in the Social/Comms section of App.tsx. Will be documented as a cross-module utility.

### B. Missing Functional Coverage
4. **`useSocialApprovals` hook** — Exists with full realtime subscription, approve/reject mutations, and `social_approvals` table. Was mentioned but incompletely modeled.
5. **`useSlotTracker` hook** — Exists but belongs to **ShopFloor module** (uses `RunPlan`, `SlotTracker`). Was incorrectly listed as Marketing scope. Will be removed.
6. **`useChannelManagement` hook** — Exists but belongs to **TeamHub/HR module** (manages team chat channels/DMs). Will be removed.
7. **`useEmailAnalytics` hook** — Exists, calls `email-analytics` edge function. Was under-documented.
8. **`useEmailAutomations` hook** — Exists with toggle/config mutations on `email_automations` table. Was under-documented.
9. **`useAdProjectHistory` hook** — Exists with full CRUD on `ad_projects` table. Was missing.
10. **`useAdDirectorBrandKit` hook** — Exists, maps `BrandProfile` ↔ `brand_kit` table. Was missing.
11. **`useAutoGenerate` hook** — 5-slot placeholder strategy (6:30, 7:30, 8:00, 12:30, 14:30 ET) was not documented. Will be restored with exact slot times.
12. **`useStrategyChecklist` hook** — Exists with optimistic updates on `social_strategy_checklist`. Was under-documented.
13. **`usePublishPost` hook** — Persian strip logic (`stripPersian`), 120s AbortController timeout, Company-First token resolution, no-fallback rule all exist. Were incompletely documented.
14. **`contentStrategyData.ts`** — 362-line Canadian/global events calendar with content themes. Was missing.
15. **`PLATFORM_PAGES` constant** — Hardcoded page names per platform (6 FB pages, 6 IG pages, 2 LinkedIn, 1 YouTube, 1 TikTok). Was missing.
16. **`PIXEL_APPROVE_PLATFORMS`** — Only `["facebook", "instagram"]` require Pixel approval. Was missing.

### C. Edge Function Corrections
17. **`ad-director-ai`** (815 lines) — The primary AI function with 14 task types, model routing table. Was completely missing.
18. **`analyze-ad-script`** — Backward-compatible proxy to `ad-director-ai`. Was missing.
19. **`video-intelligence`** — Google Video Intelligence API (label detection, speech transcription, shot change). Was missing.
20. **`transform-video-prompt`** — Video prompt transformation. Was missing.
21. **`enhance-music-prompt`** — Music prompt enhancement. Was missing.
22. **`elevenlabs-tts`** — Text-to-speech for voiceovers. Was missing from module scope.
23. **`elevenlabs-music`** — Music generation. Was missing from module scope.
24. **`lyria-music`** — Alternative music generation. Was missing.
25. **`facebook-data-deletion`** — GDPR compliance endpoint. Was missing.
26. **`gce-video-assembly`** — Server-side video assembly. Was missing.
27. **`social-intelligence`** — Business insight report combining orders, leads, social performance, Search Console, analytics. Was listed but scope was incorrect — it's a cross-module intelligence function.
28. **`pexels-search`** — Stock media search for content creation. Was missing from module scope.

### D. Permission & Security Corrections
29. **Route permissions mismatch** — Social Media Manager, Video Studio, and Ad Director use `AdminRoute allowedEmails={["zahra@rebar.shop"]}` (super admins + zahra only). Email Marketing uses `AdminRoute` (admin role only). FacebookCommenter uses `AdminRoute` (admin role only). The blueprint must reflect these exact email-gated restrictions.
30. **`social_posts` has no `company_id`** — Posts are scoped by `user_id`, not `company_id`. RLS is user-based. The blueprint incorrectly assumed company_id scoping for social_posts.
31. **`social_strategy_checklist` is user-scoped** — No company_id, uses `user_id` directly.
32. **`ad_projects` is user-scoped** — No company_id, uses `user_id` directly.
33. **`brand_kit` is user-scoped** — Uses `user_id` with upsert on conflict.
34. **`email_campaigns` has `company_id`** — Correctly company-scoped.
35. **`email_automations` has `company_id`** — Correctly company-scoped.
36. **`email_suppressions` has `company_id`** — Correctly company-scoped.
37. **`user_meta_tokens` is user-scoped** — Token storage per user, with Company-First fallback logic in edge functions.

### E. Database Corrections
38. **`user_meta_tokens` table was missing** — Critical for social publishing. Schema: `id, user_id, platform, access_token, token_type, expires_at, meta_user_id, meta_user_name, pages (JSON), instagram_accounts (JSON), scopes (text[]), last_used_at, created_at, updated_at`. Must be marked as Existing.
39. **`user_meta_tokens_safe` view was missing** — Read-only safe view (no access_token exposed). Must be documented.
40. **`ad_projects` table schema incomplete** — Missing fields: `brand_name, script, segments (JSONB), storyboard (JSONB), clips (JSONB), continuity (JSONB), final_video_url, thumbnail_url, status, user_id`. Will be corrected from actual types.ts.
41. **`integration_connections` table** — Used for tracking OAuth connection status. Cross-module but referenced by social settings.

### F. Component Coverage Gaps
42. **Ad Director editor components (25 files)** — `TimelineBar`, `BrandKitSidePanel`, `BrandKitTab`, `MusicTab`, `VoiceoverDialog`, `SubtitleDialog`, `TextOverlayDialog`, `ImageOverlayDialog`, `EffectsPanel`, `TransitionsTab`, `SpeedControlPopover`, `IntroOutroEditor`, `TemplatesTab`, `GraphicsTab`, `LogoTab`, `MediaTab`, `RecordTab`, `ScriptTab`, `SettingsTab`, `StockImagesTab`, `StockVideoTab`, `TextTab`, `TextVoiceDialog`, `AudioPromptDialog`, `EditOverlayDialog`. Were completely omitted.
43. **Ad Director top-level components (18 files)** — `AdDirectorSidebar`, `SceneCard`, `StoryboardTimeline`, `ProVideoEditor`, `FinalPreview`, `ExportDialog`, `VideoHistory`, `ChatPromptBar`, `ContinuityInspector`, `SceneIntelligenceBar`, `PromptQualityBadge`, `StepIndicator`, `VideoParameters`, `AdvancedModelSettings`, `CameraLoader`, `ScriptInput`, `AdDirectorErrorBoundary`. Were partially listed.
44. **FacebookCommenterSettings** — Component exists but was omitted.
45. **Video components** — `VideoEditor`, `VideoInsightsPanel`, `VideoLibrary`, `VideoStudioContent`, `VideoStudioPromptBar`, `VideoToSocialPanel`, `VideoGeneratorDialog`. Were partially listed.
46. **Social components** — `PixelBrainDialog`, `PixelChatRenderer`, `PixelPostCard`, `PixelPostViewPanel`, `ImageEditDialog`, `ImageGeneratorDialog`, `SelectionSubPanel`, `SchedulePopover`. Were partially listed.

### G. Type System Gaps
47. **`src/types/adDirector.ts`** — 258 lines defining `BrandProfile`, `SegmentType` (9 types), `GenerationMode` (5 modes), `ScriptSegment`, `AITaskType` (14 types), `ModelRoute`, `PromptQualityScore` (8 dimensions), `SceneIntelligence`, `StoryboardScene`, `ContinuityProfile` (11 fields), `ClipStatus`, `ClipOutput`, `AdProject`, `IntroOutroCardSettings`, `AVAILABLE_MODELS`, `DEFAULT_MODEL_ROUTES`, `TASK_CATEGORY_MAP`, `DEMO_SCRIPT`. Was completely missing from code scaffold.

---

## Fidelity Matrix

| Item | Original Evidence | Previous Blueprint | Revised Status |
|------|---|---|---|
| SocialMediaManager page | App.tsx L223, 672-line page | ✅ Included | ✅ Corrected permissions |
| VideoStudio page | App.tsx L224 | ✅ Included | ✅ Corrected permissions |
| AdDirector page | App.tsx L225 | ⚠️ Partial | ✅ Full coverage with 43 components |
| EmailMarketing page | App.tsx L226 | ✅ Included | ✅ Corrected |
| FacebookCommenter page | App.tsx L228 | ❌ Missing | ✅ Added |
| SEO module | App.tsx (separate section) | ❌ Silently merged | ✅ Separated as cross-module |
| useAdProjectHistory | src/hooks/ | ❌ Missing | ✅ Added |
| useAdDirectorBrandKit | src/hooks/ | ❌ Missing | ✅ Added |
| usePublishPost (Persian strip) | src/hooks/ | ⚠️ Partial | ✅ Full logic documented |
| 5-slot strategy | useAutoGenerate.ts L6-12 | ❌ Missing | ✅ Exact times documented |
| PLATFORM_PAGES | socialConstants.ts | ❌ Missing | ✅ Full page list |
| ad-director-ai (815L) | supabase/functions/ | ❌ Missing | ✅ Full 14-task model routing |
| video-intelligence | supabase/functions/ | ❌ Missing | ✅ Added |
| facebook-data-deletion | supabase/functions/ | ❌ Missing | ✅ Added |
| user_meta_tokens table | types.ts L14924 | ❌ Missing | ✅ Full schema |
| ad_projects table | types.ts L175 | ⚠️ Incomplete | ✅ Full schema |
| social_posts scoping | user_id not company_id | ❌ Wrong (said company_id) | ✅ Corrected |
| Route permissions | allowedEmails={["zahra@"]} | ❌ Wrong | ✅ Exact email gates |
| Ad Director types (258L) | src/types/adDirector.ts | ❌ Missing | ✅ Full type system |
| contentStrategyData (362L) | src/components/social/ | ❌ Missing | ✅ Documented |
| Editor components (25) | src/components/ad-director/editor/ | ❌ Missing | ✅ All listed |

---

## Revised Document Structure

The revised PDF will contain all 20 original sections, plus 2 new sections:

### New: 00a — Correction Summary
Every issue found and how it was fixed (the list above).

### New: 00b — Fidelity Matrix
Full traceability table mapping each item to source evidence.

### Revised Sections (major changes):

**01-system-architecture.md** — Fix tenancy model: social_posts/ad_projects/brand_kit are USER-scoped, email_campaigns/automations/suppressions are COMPANY-scoped. Remove SEO from core, add as cross-module boundary.

**02-folder-structure.md** — Add `ad-director/editor/` (25 files), `facebook/` directory, `types/adDirector.ts`.

**03-database-schema.sql** — Add `user_meta_tokens`, `user_meta_tokens_safe` view, correct `ad_projects` schema, mark each table as Existing/Inferred/Proposed, correct scoping (user_id vs company_id).

**04-rls-and-permissions.sql** — Fix access matrix: SMM/VideoStudio/AdDirector = super_admin + zahra@rebar.shop only. EmailMarketing = admin role. FacebookCommenter = admin role. Remove SEO permissions.

**05-api-contracts.md** — Add `ad-director-ai` (14 actions), `video-intelligence`, `facebook-data-deletion`. Remove SEO endpoints to cross-module section.

**06-edge-functions.md** — Add 8 missing functions (ad-director-ai, analyze-ad-script, video-intelligence, transform-video-prompt, enhance-music-prompt, facebook-data-deletion, gce-video-assembly, lyria-music). Document ElevenLabs functions (tts, music). Move SEO functions to cross-module.

**07-ui-pages-and-routes.md** — Add FacebookCommenter with full component spec. Fix permission descriptions. Add exact `allowedEmails` gates.

**08-components-spec.md** — Add all 43 Ad Director components, 7 Video components, FacebookCommenterSettings, 8 missing social components. Include props/states from actual code.

**09-state-management.md** — Add useAdProjectHistory, useAdDirectorBrandKit query keys and strategies. Document 5-slot placeholder insert pattern. Document stripPersian logic. Document 120s AbortController pattern.

**10-business-workflows.md** — Add Ad Director full pipeline (Script → Analysis → Storyboard → Prompt Generation → Video Generation → Assembly → Export). Add Company-First token resolution flow. Add 5-slot daily generation flow.

**11-integrations.md** — Add user_meta_tokens as the token storage layer. Add GDPR facebook-data-deletion. Add ElevenLabs (TTS + Music). Add Pexels. Add Google Video Intelligence. Separate SEO integrations (SEMrush, Wincher, GSC) as cross-module.

**12-ai-opportunities.md** — Add Ad Director AI model routing (14 task types, dual-provider philosophy GPT+Google). Add Pixel agent approval gate (FB+IG only). Document Penn agent for copywriting.

**13-security-checklist.md** — Fix user_id vs company_id scoping per table. Add GDPR compliance (facebook-data-deletion). Fix role matrix.

**17-sample-seed-data.sql** — Add user_meta_tokens seed. Add ad_projects seed. Fix social_posts to use user_id scoping.

**18-code-scaffold** — Expand with: AdDirector types (full adDirector.ts), useAdProjectHistory, useAdDirectorBrandKit, usePublishPost with stripPersian, FacebookCommenter page, route guards with allowedEmails, PLATFORM_PAGES constant, status enums, service layer wrappers for all edge functions, validation schemas.

**19-open-questions.md** — Add: Should social_posts migrate to company_id? Should SEO be formally extracted or remain cross-module? Should FacebookCommenter use real API or remain manual? Token rotation strategy for user_meta_tokens.

---

## Technical Approach
- Python script using ReportLab to generate a comprehensive corrected PDF
- Every section item tagged as: `[EXISTING]`, `[INFERRED]`, or `[PROPOSED]`
- All code samples from real codebase, not invented
- Output: `/mnt/documents/Marketing_Content_Module_Blueprint_v2.pdf`
- Estimated: 80-100 pages

## Impact
- 0 codebase files changed
- 1 corrected PDF artifact generated
- All 47 issues from correction summary addressed

