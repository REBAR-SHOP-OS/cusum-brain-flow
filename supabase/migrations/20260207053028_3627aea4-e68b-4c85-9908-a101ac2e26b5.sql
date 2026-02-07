
-- Add max_bars column for capacity validation (how many bars of this size can be processed at once)
ALTER TABLE public.machine_capabilities
  ADD COLUMN max_bars integer NOT NULL DEFAULT 1;

-- Add machine_model to machines table for matching against capability specs
-- (e.g., 'Rod Chomper BR18')
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS model text NULL;
