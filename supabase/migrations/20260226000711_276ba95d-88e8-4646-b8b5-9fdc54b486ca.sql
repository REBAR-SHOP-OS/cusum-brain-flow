-- Bug #1: Fix QC trigger status string mismatch (in_transit → in-transit)
CREATE OR REPLACE FUNCTION public.block_delivery_without_qc()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _missing BOOLEAN := FALSE;
BEGIN
  IF NEW.status IN ('loading', 'in-transit') AND OLD.status NOT IN ('loading', 'in-transit') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.delivery_stops ds
      JOIN public.orders o ON o.id = ds.order_id
      WHERE ds.delivery_id = NEW.id
        AND (o.qc_evidence_uploaded = FALSE OR o.qc_final_approved = FALSE)
    ) INTO _missing;

    IF _missing THEN
      RAISE EXCEPTION 'Delivery blocked: QC evidence or final approval missing on linked orders';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;