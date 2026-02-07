
-- Create reference table for rebar sizes (RSIC Canada 2017)
CREATE TABLE public.rebar_sizes (
  bar_code text PRIMARY KEY,
  diameter_mm numeric NOT NULL,
  area_mm2 integer NOT NULL,
  mass_kg_per_m numeric NOT NULL,
  standard text NOT NULL DEFAULT 'RSIC-Canada-2017',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (read-only for all authenticated users)
ALTER TABLE public.rebar_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rebar_sizes"
  ON public.rebar_sizes FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage rebar_sizes"
  ON public.rebar_sizes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed with official RSIC Canada 2017 values
INSERT INTO public.rebar_sizes (bar_code, diameter_mm, area_mm2, mass_kg_per_m) VALUES
  ('10M', 11.3, 100, 0.785),
  ('15M', 16.0, 200, 1.570),
  ('20M', 19.5, 300, 2.355),
  ('25M', 25.2, 500, 3.925),
  ('30M', 29.9, 700, 5.495),
  ('35M', 35.7, 1000, 7.850),
  ('45M', 43.7, 1500, 11.775),
  ('55M', 56.4, 2500, 19.625);
