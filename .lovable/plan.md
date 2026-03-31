

# Generate Marketing & Content Module Implementation Package

## What
Produce a complete, production-ready implementation blueprint for the **Marketing & Content** module extracted from REBAR SHOP OS as a standalone SaaS app. The output will be a comprehensive PDF document containing all 20 requested files.

## Scope Discovered from Codebase

The existing Marketing & Content footprint includes:

**Frontend Pages**: SocialMediaManager, EmailMarketing, VideoStudio, AdDirector, SeoModule
**Components**: 24 social components, 5 email-marketing components, 13 SEO components, 18+ ad-director components
**Hooks**: useSocialPosts, useEmailCampaigns, useSuppressions, useAutoGenerate, useStrategyChecklist, useSocialApprovals, usePublishPost
**Edge Functions (16+)**: social-publish, social-cron-publish, auto-generate-post, schedule-post, regenerate-post, social-intelligence, video-to-social, email-campaign-generate, email-campaign-send, email-automation-check, email-analytics, email-unsubscribe, generate-video, generate-image, generate-thumbnail, edit-video-prompt
**Database Tables**: social_posts, social_strategy_checklist, email_campaigns, email_campaign_sends, email_suppressions, brand_kit, knowledge
**AI Agents**: Pixel (social), Penn (copywriting), Seomi (SEO)

## Output Structure (20 Files in 1 PDF)

1. **00-module-summary.md** — Purpose, business goals, boundaries, assumptions
2. **01-system-architecture.md** — Full architecture with multi-tenant model
3. **02-folder-structure.md** — Complete folder tree with explanations
4. **03-database-schema.sql** — All tables, enums, indexes, FK, audit fields, company_id tenancy
5. **04-rls-and-permissions.sql** — Role model, access matrix, RLS policies
6. **05-api-contracts.md** — All endpoints with request/response examples
7. **06-edge-functions.md** — All 16+ serverless functions with I/O specs
8. **07-ui-pages-and-routes.md** — All pages with permissions, states, responsive behavior
9. **08-components-spec.md** — Major UI components with props, states, accessibility
10. **09-state-management.md** — React Query strategy, caching, realtime subscriptions
11. **10-business-workflows.md** — End-to-end flows, status transitions, approval gates
12. **11-integrations.md** — Facebook, Instagram, LinkedIn, TikTok, YouTube, Gmail, SEMrush, Wincher, ElevenLabs, Pexels
13. **12-ai-opportunities.md** — AI agents, prompt flows, human-in-the-loop rules
14. **13-security-checklist.md** — Auth, RBAC, tenant isolation, webhook verification
15. **14-test-plan.md** — Unit, integration, E2E, permission, load tests
16. **15-build-roadmap.md** — MVP → Phase 2 → Phase 3 with milestones
17. **16-env-vars.md** — All environment variables with purpose
18. **17-sample-seed-data.sql** — Realistic seed data
19. **18-code-scaffold** — Starter TypeScript/React code files
20. **19-open-questions.md** — Business clarifications needed

## Technical Approach
- Python script using ReportLab to generate a structured, multi-section PDF
- Each "file" becomes a clearly delineated section
- SQL and TypeScript code rendered in monospace
- All content derived from actual codebase analysis above
- Output: `/mnt/documents/Marketing_Content_Module_Blueprint.pdf`

## Impact
- 0 codebase files changed
- 1 comprehensive PDF artifact generated (~50-80 pages)

