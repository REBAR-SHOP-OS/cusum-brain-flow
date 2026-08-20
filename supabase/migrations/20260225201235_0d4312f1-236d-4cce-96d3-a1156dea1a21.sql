
ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.quotes ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.communications ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.delivery_stops ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.pickup_orders ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.estimation_projects ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.accounting_mirror ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.recurring_transactions ALTER COLUMN customer_id DROP NOT NULL;
