
ALTER TABLE public.tasks ADD COLUMN review_status text DEFAULT NULL;
ALTER TABLE public.tasks ADD COLUMN reviewed_by uuid DEFAULT NULL;
