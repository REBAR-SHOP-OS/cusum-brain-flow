
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
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ledger"
  ON public.credit_ledger FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
