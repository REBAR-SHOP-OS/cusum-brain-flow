

## AI Video Studio -- Gap Analysis & Upgrade Plan

After reviewing the existing codebase thoroughly, **most of the requested system is already built across Phases 1-3**. This plan focuses on the specific gaps between what exists and what was requested.

### What Already Exists (No Changes Needed)
- Prompt Transformer Engine (edge function + hook)
- Construction keyword enhancement
- Mode selector (Fast/Balanced/Premium) mapped to Sora/Veo
- Duration & aspect ratio selectors
- Engineered prompt preview toggle
- Credit system with cost display
- Video generation with Veo -> Sora -> Slideshow fallback
- Video Editor (trim, extend, regenerate, style, lighting, remove, background)
- Social panel (caption, hashtags, platform selector, draft saving)
- Audio generation & merging
- Video Library
- Multi-scene architecture

### Gaps to Fill

**1. Intent Detection** -- Add `intent` and `platform_intent` fields to the prompt transformer output. Update `transform-video-prompt` edge function system prompt to classify intent (product promo, cinematic b-roll, industrial machinery, etc.) and return it in the JSON response. Surface detected intent as a badge in the UI.

**2. Generations Table (Persistent Job Records)** -- Create a `generations` table storing: `raw_prompt`, `engineered_prompt`, `mode`, `duration_seconds`, `aspect_ratio`, `provider`, `status` (draft/queued/processing/completed/failed), `estimated_credits`, `actual_credits`, `output_asset_url`, `job_id`, `error_message`, `metadata` (JSONB for elements/intent). Insert a record at generation start, update on completion/failure. This replaces the ephemeral in-memory state tracking.

**3. Credit Ledger** -- Create a `credit_ledger` table for transaction-level tracking: `user_id`, `type` (reserve/consume/refund), `amount`, `generation_id`, `description`, `created_at`. Modify `useVideoCredits` to write ledger entries on reserve and finalize. On failure, issue a refund entry and restore credits.

**4. Credit Refund on Failure** -- When a generation fails, automatically refund reserved credits by inserting a refund ledger entry and decrementing `used_seconds` in `video_credits`.

**5. Reference Image Upload** -- Add an image upload input to the Studio UI. Pass the uploaded image URL to `generate-video` for image-to-video mode (already partially supported by the Veo/Sora APIs).

**6. Additional Editing Tools** -- Add "Subtitle" and "Text Overlay" tools to the VideoEditor tool grid. Subtitle uses the Lovable AI gateway to generate SRT-style captions. Text overlay uses canvas compositing (client-side, no GPU). "Resize for Platform" tool crops/letterboxes video client-side via canvas.

**7. UI Label Updates** -- Change prompt label to "What do you want to create?", placeholder to "Say it naturally -- we'll turn it into a production-ready video prompt.", and update suggestion chips to match the requested examples.

### Database Migrations

```sql
-- generations table
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  raw_prompt TEXT NOT NULL,
  engineered_prompt TEXT,
  intent TEXT,
  mode TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  aspect_ratio TEXT DEFAULT '16:9',
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  estimated_credits INTEGER DEFAULT 0,
  actual_credits INTEGER DEFAULT 0,
  output_asset_url TEXT,
  job_id TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own generations"
  ON public.generations FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- credit_ledger table
CREATE TABLE public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  generation_id UUID REFERENCES public.generations(id),
  type TEXT NOT NULL, -- reserve, consume, refund
  amount INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ledger"
  ON public.credit_ledger FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Implementation Tasks

1. Run DB migration for `generations` and `credit_ledger` tables
2. Update `transform-video-prompt` edge function to include intent detection
3. Create `useGenerations` hook for CRUD on generations table
4. Modify `VideoStudioContent.tsx`:
   - Update labels/placeholders
   - Add reference image upload
   - Write generation record on start, update on complete/fail
   - Add refund logic on failure
   - Show intent badge from transformer result
5. Add subtitle, text overlay, and resize tools to `VideoEditor.tsx`
6. Update `useVideoCredits` to write ledger entries

### What Is Intentionally NOT Built
- Redis/BullMQ queue system (not compatible with this stack -- the existing polling-based async system with edge functions serves the same purpose)
- Python/Node backend (this is a React + Supabase project)
- FFmpeg CPU workers (client-side canvas processing handles post-processing)
- S3/R2 storage (Supabase Storage is already in use)

These architectural differences are appropriate because the project runs on Lovable Cloud (Supabase), not a custom backend infrastructure.

