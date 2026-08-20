
CREATE OR REPLACE FUNCTION public.block_production_without_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _order_id UUID;
  _sd_status TEXT;
  _pending_co BOOLEAN;
  _qc_approved TIMESTAMPTZ;
BEGIN
  -- Only check when phase transitions to cutting from a non-cutting phase
  -- AND only when production hasn't already started (no completed pieces yet)
  IF NEW.phase = 'cutting' AND (OLD.phase IS DISTINCT FROM 'cutting')
     AND COALESCE(OLD.completed_pieces, 0) = 0 THEN
    -- Resolve order_id via work_order
    IF NEW.work_order_id IS NOT NULL THEN
      SELECT wo.order_id INTO _order_id
        FROM public.work_orders wo WHERE wo.id = NEW.work_order_id;
    END IF;

    IF _order_id IS NOT NULL THEN
      SELECT shop_drawing_status, pending_change_order, qc_internal_approved_at
        INTO _sd_status, _pending_co, _qc_approved
        FROM public.orders WHERE id = _order_id;

      IF _sd_status != 'approved' THEN
        RAISE EXCEPTION 'Production blocked: shop drawing not approved (status: %)', _sd_status;
      END IF;
      IF _pending_co = TRUE THEN
        RAISE EXCEPTION 'Production blocked: pending change order';
      END IF;
      IF _qc_approved IS NULL THEN
        RAISE EXCEPTION 'Production blocked: QC internal approval missing';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
