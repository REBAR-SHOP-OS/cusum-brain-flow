
-- Video credits system
CREATE TABLE public.video_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  total_seconds INTEGER NOT NULL DEFAULT 60,
  used_seconds INTEGER NOT NULL DEFAULT 0,
  plan TEXT NOT NULL DEFAULT 'free',
  period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('month', now()),
  period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('month', now()) + interval '1 month',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint per user per period
CREATE UNIQUE INDEX idx_video_credits_user_period ON public.video_credits (user_id, period_start);

-- Usage log for audit trail
CREATE TABLE public.video_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  credits_id UUID REFERENCES public.video_credits(id) ON DELETE CASCADE,
  seconds_used INTEGER NOT NULL,
  generation_mode TEXT NOT NULL,
  prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.video_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits"
  ON public.video_credits FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own credits"
  ON public.video_credits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own credits"
  ON public.video_credits FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own usage log"
  ON public.video_usage_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own usage log"
  ON public.video_usage_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
