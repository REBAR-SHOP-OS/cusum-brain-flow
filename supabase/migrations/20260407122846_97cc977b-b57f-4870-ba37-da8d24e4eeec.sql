-- Change customer FK constraints from SET NULL to RESTRICT on critical financial tables
-- This prevents customer deletion when they have linked invoices, orders, quotes, or leads

-- accounting_mirror
ALTER TABLE public.accounting_mirror DROP CONSTRAINT accounting_mirror_customer_id_fkey;
ALTER TABLE public.accounting_mirror ADD CONSTRAINT accounting_mirror_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

-- orders
ALTER TABLE public.orders DROP CONSTRAINT orders_customer_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

-- quotes
ALTER TABLE public.quotes DROP CONSTRAINT quotes_customer_id_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

-- leads
ALTER TABLE public.leads DROP CONSTRAINT leads_customer_id_fkey;
ALTER TABLE public.leads ADD CONSTRAINT leads_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;