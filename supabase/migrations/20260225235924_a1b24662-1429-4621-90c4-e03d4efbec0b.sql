-- Bug #4: Replace global unique on delivery_number with per-company unique
-- First drop the existing global unique constraint
ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_delivery_number_key;

-- Add compound unique constraint (company_id, delivery_number)
ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_company_delivery_number_key UNIQUE (company_id, delivery_number);

-- Bug #7: Add driver_profile_id to deliveries for proper driver filtering
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS driver_profile_id uuid REFERENCES public.profiles(id);

-- Create index for driver lookups
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_profile_id ON public.deliveries(driver_profile_id);
