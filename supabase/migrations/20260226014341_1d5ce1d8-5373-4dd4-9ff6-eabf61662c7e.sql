
-- R15-1: Block lead deletion if quotes exist
CREATE OR REPLACE FUNCTION public.block_lead_delete_with_children()
RETURNS TRIGGER AS $$
DECLARE
  quote_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO quote_count FROM public.quotes WHERE lead_id = OLD.id;
  IF quote_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete lead with % linked quote(s)', quote_count;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER block_lead_delete_with_children
BEFORE DELETE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.block_lead_delete_with_children();

-- R15-2: Block customer deletion if orders exist
CREATE OR REPLACE FUNCTION public.block_customer_delete_with_orders()
RETURNS TRIGGER AS $$
DECLARE
  order_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO order_count FROM public.orders WHERE customer_id = OLD.id;
  IF order_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete customer with % active order(s)', order_count;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER block_customer_delete_with_orders
BEFORE DELETE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.block_customer_delete_with_orders();
