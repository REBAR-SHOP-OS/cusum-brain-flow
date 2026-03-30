

# Generate Social Media Manager Architecture PDF

## Objective
Create a comprehensive PDF document describing the full architecture and rules governing the Social Media Manager module.

## Document Structure

### 1. Overview
- Module purpose: manage social media content lifecycle (create → review → approve → schedule → publish)
- Supported platforms: Facebook, Instagram, LinkedIn, Twitter/X, TikTok, YouTube

### 2. Database Layer
- **`social_posts`** table: core entity with fields for platform, status, qa_status, content, engagement metrics, neel_approved, decline_reason
- **`social_approvals`** table: approval workflow records (pending/approved/rejected, deadline, escalation_count)
- **`social_strategy_checklist`** table: content strategy tracking
- **`integration_connections`** table: OAuth tokens per platform
- **`user_meta_tokens`** table: Facebook/Instagram page tokens
- Realtime enabled on both social_posts and social_approvals

### 3. Post Lifecycle (Status Machine)
```
draft → pending_approval → [approved] → scheduled → published
                         → [rejected] → declined
                         → [overdue without approval] → failed
```

### 4. Rules & Guards
- **Approval Gate**: `neel_approved = true` required before publishing (bypass only for radin@rebar.shop, zahra@rebar.shop)
- **Declined Posts**: NEVER publishable (hard 403 block)
- **Duplicate Prevention**: Same title + platform + page_name cannot be published twice on the same day (409 Conflict)
- **Calendar Consolidation**: Max 1 card per platform per day, with deduplication of same title+page
- **Persian Text Strip**: Automatically removes Persian translation blocks before publishing
- **Overdue Unapproved**: Cron marks as "failed" instead of auto-approving

### 5. Frontend Architecture
- **Page**: `SocialMediaManager.tsx` — main orchestrator with week view, filters, tabs
- **Calendar**: `SocialCalendar.tsx` — 7-day grid with groupByPlatform + deduplicatePosts
- **Post Review**: `PostReviewPanel.tsx` — edit/approve/schedule/publish individual posts
- **Approvals**: `ApprovalsPanel.tsx` — pending approvals list with approve/reject actions
- **Content Strategy**: `ContentStrategyPanel.tsx` — strategy checklist
- **Brand Kit**: `BrandKitDialog.tsx` — brand assets management
- **Create Content**: `CreateContentDialog.tsx` — new post creation
- **Image/Video**: `ImageGeneratorDialog.tsx`, `VideoGeneratorDialog.tsx` — AI media generation

### 6. Hooks Layer
- `useSocialPosts` — CRUD + realtime subscription on social_posts
- `useSocialApprovals` — approval workflow + realtime
- `usePublishPost` — publish with 120s timeout, duplicate guard, Persian strip
- `useAutoGenerate` — AI content generation via `auto-generate-post` edge function
- `useStrategyChecklist` — content strategy tracking
- `schedulePost` — scheduling with frontend duplicate check + edge function + DB fallback

### 7. Backend (Edge Functions)
- **`social-publish`**: Publishes to Facebook/Instagram/LinkedIn via Graph API / LinkedIn API, with all guards
- **`social-cron-publish`**: Automated scheduled publishing cron, same guards
- **`schedule-post`**: Schedule post + clone for multi-platform/page combos
- **`auto-generate-post`**: AI-powered content generation
- **`regenerate-post`**: Re-generate content for existing post
- **`social-intelligence`**: Analytics and insights
- **`approval-notify`**: Send approval notifications

### 8. Integration Connections
- Facebook/Instagram: OAuth via `facebook-oauth`, tokens in `user_meta_tokens` with page-level tokens
- LinkedIn: OAuth via `linkedin-oauth`, tokens in `integration_connections` with tenant-wide fallback
- Token refresh: automatic page token refresh before each publish

### 9. Architecture Diagram (included in PDF)

## Implementation
- Generate PDF using Python reportlab
- Include flowcharts as text diagrams
- Write to `/mnt/documents/Social_Media_Architecture.pdf`

## File
- `/mnt/documents/Social_Media_Architecture.pdf`

