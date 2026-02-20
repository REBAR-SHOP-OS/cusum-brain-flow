

# Multi-Agent AI and Social Media Autopilot -- Gap Analysis and Implementation Plan

## What Already Exists (No Work Needed)

The strategy document proposes an architecture that is largely **already built**. Here is the mapping:

| Proposed Component | Already Exists As | Status |
|---|---|---|
| SalesOpsAgent | **Blitz** (sales rep) + **Commander** (sales ops) | Done |
| ProductionPlannerAgent | **Forge** (shopfloor agent) | Done |
| CustomerSupportAgent | **Haven** (support agent) | Done |
| ExecutiveSummaryAgent | **agentExecutiveContext.ts** (Phase 6) for Data/Empire/Commander | Done |
| AuditAgent | **agentQA.ts** (Phase 4) -- QA reviewer layer | Done |
| ContentGenAgent | **Pixel** agent + `auto-generate-post` edge function | Done |
| Router / Orchestrator | Hybrid keyword + LLM router (`agent-router`) | Done |
| Domain-separated memory | RAG with pgvector (`document_embeddings`, `embed-documents`, `search-embeddings`) | Done |
| Prompt caching | Static/dynamic prefix split in `ai-agent/index.ts` (Phase 5) | Done |
| Image generation | `generate-image` edge function (DALL-E) | Done |
| Video generation | `generate-video` edge function (Veo 3.0) | Done |
| Social publishing | `social-publish` (Facebook/Instagram/LinkedIn Graph API) | Done |
| Cron publishing | `social-cron-publish` (auto-publishes scheduled posts) | Done |
| Social intelligence | `social-intelligence` (business insights + trend analysis) | Done |

## Actual Gaps to Implement

After auditing what exists, **three meaningful gaps** remain from the strategy document:

### Gap 1: Approval Workflow Agent (ApprovalAgent)

Currently, posts move through statuses manually (draft -> scheduled -> published). There is no automated notification pipeline to Radin/Neel when content is ready for review, no timeout escalation, and no structured approval/rejection flow with feedback loops.

**What to build:**
- A `social_approvals` table tracking approval requests, assigned approver, deadline, decision, and feedback
- An `approval-notify` edge function that sends push/email notifications when a post enters "pending_approval" status
- Auto-escalation: if no response within a configurable window (e.g., 4 hours), re-notify or escalate
- Wire the ContentGen output (from `auto-generate-post`) to automatically create approval records instead of going straight to "scheduled"
- Add an Approvals panel in the Social Media Manager UI showing pending items with Approve/Reject + feedback input

### Gap 2: Twitter/X Publishing Support

The `social-publish` function currently supports Facebook, Instagram, and LinkedIn only. Twitter/X is listed as a platform in the UI but publishing is not implemented.

**What to build:**
- Add Twitter OAuth 1.0a signing to `social-publish` using the `api.x.com/2` endpoint
- Support text-only and text+media tweets
- Ensure the user has configured `TWITTER_CONSUMER_KEY`, `TWITTER_CONSUMER_SECRET`, `TWITTER_ACCESS_TOKEN`, and `TWITTER_ACCESS_TOKEN_SECRET`

### Gap 3: TikTok Publishing Support

TikTok is listed in the platform filters but has no publishing integration.

**What to build:**
- Add TikTok Content Posting API support to `social-publish` (video upload via `tiktok-oauth` flow that already exists)
- Requires TikTok developer app credentials

## Implementation Steps

### Step 1: Approval Workflow (Database)

Create a `social_approvals` table:

```text
social_approvals
  id              UUID PK
  post_id         UUID FK -> social_posts.id
  approver_id     UUID (user who should review)
  status          TEXT (pending / approved / rejected)
  feedback        TEXT (rejection reason or notes)
  deadline        TIMESTAMPTZ
  decided_at      TIMESTAMPTZ
  created_at      TIMESTAMPTZ
```

Add RLS policies scoped to the approver's user ID and the post owner.

### Step 2: Approval Notification Edge Function

Create `approval-notify` edge function:
- Triggered when a post status changes to "pending_approval"
- Looks up assigned approvers from `social_approvals`
- Sends push notification (via existing `send-push`) and/or email
- Records notification timestamp for escalation tracking

### Step 3: Auto-Generate -> Approval Pipeline

Modify `auto-generate-post` so newly generated posts:
1. Are saved with status `"pending_approval"` (not `"draft"`)
2. Automatically create a `social_approvals` record targeting the configured approver(s)
3. Trigger the `approval-notify` function

### Step 4: Approval UI in Social Media Manager

Add an "Approvals" tab/section:
- List of pending approval posts with preview (text + image)
- Approve button (moves to "scheduled" with next available slot)
- Reject button with feedback textarea (moves to "declined", feedback saved)
- Badge count on the tab showing pending items

### Step 5: Twitter/X Publishing

Add to `social-publish`:
- OAuth 1.0a signature generation for Twitter API v2
- Text post endpoint: `POST https://api.x.com/2/tweets`
- Media upload via `https://upload.twitter.com/1.1/media/upload.json` for image posts
- Check for required secrets before attempting

### Step 6: Escalation Cron

Add a cron job (every 2 hours) that:
- Queries `social_approvals` where status = 'pending' and deadline < now()
- Re-sends notification to approver
- After 2 missed deadlines, auto-escalates (e.g., notifies admin or auto-approves based on policy)

## What We Are NOT Doing (and Why)

| Proposed Item | Why Not |
|---|---|
| Separate vector DB (Weaviate/Chroma/Pinecone) | pgvector already handles this with HNSW index |
| LangChain / LlamaIndex | System is TypeScript/Deno; `aiRouter.ts` already provides equivalent functionality |
| Self-hosted GPU / open-source models | API access to GPT/Gemini is already configured with fallback routing |
| Multi-tenant SaaS architecture | Premature -- system serves one company; can be added later |
| Kubernetes / KServe / Airflow | Edge functions already provide serverless isolation |
| DALL-E / Stable Diffusion comparison | `generate-image` already uses DALL-E; `generate-video` uses Veo 3.0 |
| Synthesia video | Veo 3.0 is already integrated and more cost-effective |
| Grafana / Datadog monitoring | Executive dashboard context (Phase 6) already provides KPI aggregation |

## Timeline Estimate

| Step | Effort |
|---|---|
| Step 1: Approval table + RLS | 1 hour |
| Step 2: approval-notify function | 1 hour |
| Step 3: Wire auto-generate pipeline | 1 hour |
| Step 4: Approval UI components | 2 hours |
| Step 5: Twitter/X publishing | 2 hours (requires API keys) |
| Step 6: Escalation cron | 30 min |
| **Total** | **~7.5 hours** |

