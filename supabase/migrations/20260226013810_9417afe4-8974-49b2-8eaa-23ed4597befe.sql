
-- R14-2: Block delivery delete unless status is 'pending'
CREATE OR REPLACE FUNCTION public.block_delivery_delete_unless_pending()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS NOT NULL AND OLD.status != 'pending' THEN
    RAISE EXCEPTION 'Cannot delete delivery in status: %', OLD.status;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER block_delivery_delete_unless_pending
BEFORE DELETE ON public.deliveries
FOR EACH ROW
EXECUTE FUNCTION public.block_delivery_delete_unless_pending();
