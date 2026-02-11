
# Multi-Phase Enhancement Plan

This plan covers all four approved goals plus integrating the "app-oriented + conscious" architectural vision you outlined. Given the "one change at a time" rule, each phase is designed to be independently deployable.

---

## Phase 1: Email AI Enhancements (FlyMail-Inspired)

### 1A. Add "Polish" action to draft-email edge function
**File:** `supabase/functions/draft-email/index.ts`
- Add new `action: "polish"` handler that takes `draftText` and rewrites it for grammar, clarity, and conciseness without changing tone or meaning
- Uses `gemini-2.5-flash-lite` with a tight system prompt focused on cleaning up text

### 1B. Add "Prompt-to-Draft" action
**File:** `supabase/functions/draft-email/index.ts`
- Add new `action: "prompt-to-draft"` that takes a short user prompt (typed or spoken) plus optional context (recipient, subject) and generates a full email body
- Different from the existing "draft" action which requires an incoming email to reply to

### 1C. Enhanced Compose UI
**File:** `src/components/inbox/ComposeEmailDialog.tsx`
- Add a "Prompt" input field above the body textarea -- user types what they want to say in plain language, clicks "Generate", AI writes the email
- Add a "Polish" button next to the existing tone buttons that runs the polish action on current body text
- Wire existing `useSpeechRecognition` hook to the prompt field for voice-to-text input (microphone icon button)

### 1D. Enhanced Reply UI
**File:** `src/components/inbox/EmailReplyComposer.tsx`
- Add "Polish" button alongside existing tone adjustment buttons
- Add voice input option for the reply text area using `useSpeechRecognition`

### 1E. Tone selector expansion
**Files:** `EmailReplyComposer.tsx`, `ComposeEmailDialog.tsx`
- Add "Friendly" and "Urgent" to the existing TONES array (currently: Formal, Casual, Shorter, Longer)
- Add corresponding tone instructions in `draft-email/index.ts` adjust-tone handler

---

## Phase 2: Brain Knowledge Storage

### One-time data insert via migration
- Insert two knowledge records into the `knowledge` table:
  - "FlyMail.ai -- AI Email Writing Assistant Analysis" (category: research)
  - "Realize by Taboola -- AI Performance Advertising Platform Analysis" (category: research)
- Content will be the full research text provided by you
- No code changes needed -- uses existing Brain UI for viewing

---

## Phase 3: Landing Page Refresh (Realize-Inspired)

### Redesign `src/pages/Landing.tsx`
- **Hero section**: Bold headline with animated stat counters (reuse `AnimatedCounter` pattern from CEO dashboard) showing metrics like "10,000+ tons processed", "500+ projects delivered"
- **Feature grid**: Replace current 4-column grid with a 3-column card layout using larger cards with icons, titles, and 2-line descriptions for 6 key modules (Estimating, Shop Floor, Pipeline, Inbox AI, Accounting, Delivery)
- **How It Works**: 3-step horizontal flow (Sign Up -> Configure -> Operate) with numbered badges
- **Social proof / trust section**: Industry standards badges (CSA G30.18, RSIC Canada) and placeholder testimonial area
- **Multiple CTAs**: Hero CTA, mid-page CTA after features, bottom CTA before footer
- **Mobile-responsive**: All sections stack on mobile with proper spacing

---

## Phase 4: Ad Campaign Manager (Realize-Inspired)

### 4A. Database tables
- `campaigns` table: id, company_id, name, status (draft/active/paused/completed), budget, goal_type (leads/sales/signups), platform, start_date, end_date, created_at, updated_at
- `campaign_metrics` table: id, campaign_id, date, impressions, clicks, conversions, spend, cpa, roas, created_at
- RLS policies: company-scoped access, admin/sales/office roles can read, admin can write

### 4B. New page and components
- `src/pages/Campaigns.tsx` -- Dashboard with KPI hero cards (Total Spend, Avg CPA, Total Conversions, ROAS) using Recharts for trend lines
- `src/components/campaigns/CampaignCard.tsx` -- Card component per campaign showing status badge, budget, key metrics
- `src/components/campaigns/CampaignForm.tsx` -- Create/edit dialog for campaigns
- `src/components/campaigns/CampaignMetricsChart.tsx` -- Line chart showing daily performance

### 4C. Navigation
- Add "Campaigns" to `AppSidebar.tsx` under the "Office" group
- Route: `/campaigns` in `App.tsx`
- Roles: admin, sales, office

---

## Recommended Implementation Order

1. **Phase 2** (Brain storage) -- 2 minutes, zero risk
2. **Phase 1** (Email AI) -- Highest daily-use impact
3. **Phase 3** (Landing page) -- Brand improvement
4. **Phase 4** (Campaign manager) -- New capability, largest scope

Each phase is independent. I recommend starting with Phase 2 + Phase 1 together since Phase 2 is just a data insert.
