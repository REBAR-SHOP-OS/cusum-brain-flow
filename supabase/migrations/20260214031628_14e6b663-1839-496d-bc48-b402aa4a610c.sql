
ALTER TABLE public.penny_collection_queue
  ADD COLUMN assigned_to UUID REFERENCES public.profiles(id),
  ADD COLUMN assigned_at TIMESTAMPTZ;
