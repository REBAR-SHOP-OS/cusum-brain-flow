
-- Brand Kit persistence table
CREATE TABLE public.brand_kit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  business_name TEXT NOT NULL DEFAULT 'Rebar.shop',
  logo_url TEXT,
  brand_voice TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  value_prop TEXT NOT NULL DEFAULT '',
  colors JSONB NOT NULL DEFAULT '{"primary":"#2563EB","secondary":"#FACC15","tertiary":"#1F2937"}'::jsonb,
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_kit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own brand kit"
  ON public.brand_kit FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own brand kit"
  ON public.brand_kit FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brand kit"
  ON public.brand_kit FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_brand_kit_updated_at
  BEFORE UPDATE ON public.brand_kit
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
