

# World-Class AI-Driven Social Media Engine for Rebar.shop

## Current State Assessment

The Social Media Manager has a solid foundation but has 9 critical gaps preventing it from being a fully automated, intelligence-driven system:

1. **Brand Kit not persisted** -- resets on refresh (local state only)
2. **Auto-generate uses wrong image model** -- `gemini-2.5-flash` cannot generate images; should use `gemini-3-pro-image-preview`
3. **Images upload to wrong bucket** -- `estimation-files` instead of `social-images`
4. **LinkedIn publishing not wired** -- OAuth exists but `social-publish` only supports Facebook/Instagram
5. **No scheduled publishing cron** -- "Scheduled" is just a label; nothing triggers publish at the scheduled time
6. **No business intelligence injection** -- posts are generic; not informed by real data (leads, orders, Google Analytics, Search Console)
7. **No competitor/industry research** -- content is created in a vacuum
8. **Multi-platform generation** -- auto-generate creates 5 posts for 1 platform only, not cross-platform
9. **No LinkedIn Copilot integration** -- LinkedIn posts don't leverage LinkedIn-specific best practices or article format

---

## Implementation Plan

### Phase 1 -- Fix Foundations (Critical Bugs)

**1.1 Persist Brand Kit to database**
- Create `brand_kit` table: `id, user_id, business_name, logo_url, brand_voice, description, value_prop, colors (jsonb), media_urls (text[]), updated_at`
- Update `BrandKitDialog.tsx` to load from and save to database
- Inject brand kit data into Pixel's context in `ai-agent` edge function

**1.2 Fix auto-generate image model**
- In `auto-generate-post/index.ts`, replace `google/gemini-2.5-flash` with `google/gemini-3-pro-image-preview` for image generation
- Upload to `social-images` bucket instead of `estimation-files`

**1.3 Fix storage bucket routing**
- All social media uploads route to `social-images` (public bucket, already exists)

### Phase 2 -- Business Intelligence Engine

**2.1 New edge function: `social-intelligence`**
- Gathers real business data before content generation:
  - Recent orders/leads from database (what products are selling, new customers)
  - Google Analytics data (top pages, traffic trends) via stored Google OAuth tokens
  - Google Search Console data (top queries, CTR, impressions) via stored tokens
  - Recent customer communications (what questions are being asked)
  - LinkedIn company page analytics (if connected)
- Returns a structured `BusinessInsightReport` that feeds into content generation

**2.2 Inject intelligence into Pixel's context**
- Update `fetchContext` for `social` agent to call `social-intelligence` 
- Pixel's prompt receives real data: "Your top-selling product this week is Rebar Stirrups (12 orders). Traffic to rebar.shop increased 15% from Search Console. Top search query: 'rebar fabrication Ontario'"
- Content becomes data-driven: posts reference real trends, real products, real performance

**2.3 Update auto-generate pipeline**
- Before generating posts, call `social-intelligence` to get fresh business data
- Inject insights into the generation prompt so every auto-generated post is grounded in real business performance

### Phase 3 -- Multi-Platform Cross-Posting

**3.1 Upgrade auto-generate to multi-platform**
- Generate platform-optimized variations for each time slot:
  - Facebook: longer captions, community engagement focus
  - Instagram: visual-first, hashtag strategy (30 max), story-style CTAs
  - LinkedIn: professional/B2B angle, industry thought leadership, article-style
  - Twitter/X: concise, thread-ready, engagement hooks
- Each platform gets content adapted to its best practices, not copy-pasted

**3.2 Add LinkedIn publishing to `social-publish`**
- Wire the existing `linkedin-oauth` `create-post` action into the `social-publish` edge function
- Add `"linkedin"` to the platform enum in the Zod schema
- Support text posts and image posts via LinkedIn's UGC API (already built in `linkedin-oauth`)

### Phase 4 -- Automated Scheduled Publishing (Cron)

**4.1 New edge function: `social-cron-publish`**
- Queries `social_posts` for posts with `status = 'scheduled'` and `scheduled_date <= now()`
- For each due post, calls the appropriate platform publish function (Facebook, Instagram, LinkedIn)
- Updates status to `published` on success, `failed` on error
- Logs results for audit trail

**4.2 Set up pg_cron job**
- Run every 5 minutes: check for scheduled posts that are due
- Uses service role key for authentication

### Phase 5 -- LinkedIn Copilot Mode

**5.1 LinkedIn-specific content intelligence**
- When generating LinkedIn content, the prompt includes:
  - B2B construction industry trends
  - Professional thought leadership angle
  - LinkedIn algorithm best practices (engagement in first hour, comment prompts, carousel-style text)
  - Company page optimization tips
- LinkedIn posts get a distinct treatment: longer, more professional, article-preview format

**5.2 LinkedIn article drafts**
- For weekly/monthly cadence, generate LinkedIn article outlines (not just posts)
- Topics derived from business intelligence: "How AI is transforming rebar fabrication" based on actual operational data

### Phase 6 -- Research-Driven Content

**6.1 Industry trend injection**
- Use Lovable AI to analyze construction industry trends before generating content
- Prompt includes: Ontario construction market updates, OHSA regulatory changes, infrastructure spending
- Content references real-world events and industry developments

**6.2 Competitor awareness**
- Knowledge base items tagged `social-strategy` already feed into Pixel
- Add a structured competitor analysis section to the knowledge base
- Pixel references competitive positioning when creating content

---

## Technical Details

### New Database Table
```text
brand_kit:
  id (uuid, PK)
  user_id (uuid, FK to auth.users, unique)
  business_name (text)
  logo_url (text, nullable)
  brand_voice (text)
  description (text)
  value_prop (text)
  colors (jsonb)
  media_urls (text[])
  created_at (timestamptz)
  updated_at (timestamptz)
```

### New Edge Functions
- `social-intelligence` -- Gathers business data from DB + Google APIs
- `social-cron-publish` -- Scheduled publishing cron handler

### Modified Edge Functions
- `auto-generate-post` -- Multi-platform + intelligence injection + correct image model
- `social-publish` -- Add LinkedIn support
- `ai-agent` -- Inject brand kit + business intelligence into Pixel's context

### Modified Components
- `BrandKitDialog.tsx` -- Database persistence
- `SocialMediaManager.tsx` -- Multi-platform auto-generate options
- `PostReviewPanel.tsx` -- Enable Publish button for LinkedIn

### pg_cron Job
- Every 5 minutes: invoke `social-cron-publish` to publish due posts

