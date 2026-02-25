ALTER TABLE public.work_orders
  DROP CONSTRAINT work_orders_barlist_id_fkey;

ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_barlist_id_fkey
  FOREIGN KEY (barlist_id) REFERENCES public.barlists(id) ON DELETE SET NULL;