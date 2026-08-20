
-- Update validate_order_status to accept the expanded 16-stage ladder
CREATE OR REPLACE FUNCTION public.validate_order_status()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
DECLARE
  allowed TEXT[] := ARRAY[
    'pending', 'confirmed',
    'extract_new', 'needs_customer', 'needs_scope_confirm', 'needs_pricing',
    'quote_ready', 'quote_sent', 'won', 'lost', 'archived',
    'approved', 'queued_production', 'in_production', 'ready',
    'delivery_staged', 'ready_for_pickup', 'delivered',
    'invoiced', 'partially_paid', 'paid', 'closed', 'cancelled'
  ];
BEGIN
  IF NEW.status IS NOT NULL AND NOT (NEW.status = ANY(allowed)) THEN
    RAISE EXCEPTION 'Invalid order status: %. Allowed: %', NEW.status, array_to_string(allowed, ', ');
  END IF;
  RETURN NEW;
END;
$$;
