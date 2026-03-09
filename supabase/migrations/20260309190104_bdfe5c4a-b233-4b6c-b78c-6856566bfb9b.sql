
CREATE TABLE public.glasses_captures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT,
  analysis TEXT,
  source TEXT NOT NULL DEFAULT 'glasses',
  prompt TEXT,
  metadata JSONB,
  company_id TEXT NOT NULL DEFAULT 'cusum',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.glasses_captures ENABLE ROW LEVEL SECURITY;

-- Allow public insert (webhook is authenticated via API key in the function)
CREATE POLICY "Allow public insert on glasses_captures"
  ON public.glasses_captures FOR INSERT
  WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read on glasses_captures"
  ON public.glasses_captures FOR SELECT
  TO authenticated
  USING (true);
