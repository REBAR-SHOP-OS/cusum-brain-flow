-- C7 Pickup Completion Gate
-- Surgical, additive: BEFORE UPDATE trigger on pickup_orders enforces
-- final photo + signature + every item verified before status -> 'released'.
-- AFTER UPDATE trigger writes audit event. Respects _workflow_override_active().

-- 1. Add final_photo_path column for proof-of-load photo (nullable).
ALTER TABLE public.pickup_orders
  ADD COLUMN IF NOT EXISTS final_photo_path text;

-- 2. Gate trigger
CREATE OR REPLACE FUNCTION public.validate_pickup_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _item_count       integer := 0;
  _unverified_count integer := 0;
BEGIN
  -- Only gate when transitioning into a completed state.
  IF NEW.status NOT IN ('released', 'collected') THEN
    RETURN NEW;
  END IF;

  -- If status didn't actually change to a completed state, skip.
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF public._workflow_override_active() THEN
    RETURN NEW;
  END IF;

  -- Require customer signature.
  IF NEW.signature_data IS NULL OR length(trim(NEW.signature_data)) = 0 THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_PICKUP_SIGNATURE_REQUIRED: customer signature is required to complete pickup'
      USING ERRCODE = 'P0001';
  END IF;

  -- Require final load photo.
  IF NEW.final_photo_path IS NULL OR length(trim(NEW.final_photo_path)) = 0 THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_PICKUP_PHOTO_REQUIRED: final load photo is required to complete pickup'
      USING ERRCODE = 'P0001';
  END IF;

  -- Require at least one item.
  SELECT count(*) INTO _item_count
    FROM public.pickup_order_items
   WHERE pickup_order_id = NEW.id;

  IF _item_count = 0 THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_PICKUP_NO_ITEMS: pickup order has no items to confirm'
      USING ERRCODE = 'P0001';
  END IF;

  -- Require every item verified.
  SELECT count(*) INTO _unverified_count
    FROM public.pickup_order_items
   WHERE pickup_order_id = NEW.id
     AND verified = false;

  IF _unverified_count > 0 THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_PICKUP_CHECKLIST_INCOMPLETE: % item(s) not yet verified', _unverified_count
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_pickup_completion ON public.pickup_orders;
CREATE TRIGGER trg_validate_pickup_completion
BEFORE UPDATE ON public.pickup_orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_pickup_completion();

-- 3. Audit trigger — fires after a successful completion transition.
CREATE OR REPLACE FUNCTION public.log_pickup_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _item_count integer := 0;
BEGIN
  IF NEW.status NOT IN ('released', 'collected') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _item_count
    FROM public.pickup_order_items
   WHERE pickup_order_id = NEW.id;

  INSERT INTO public.activity_events (
    company_id, event_type, entity_type, entity_id, actor_id, source, description, metadata
  ) VALUES (
    NEW.company_id,
    'audit',
    'pickup_order',
    NEW.id::text,
    auth.uid()::text,
    'workflow_gate',
    'pickup_completed',
    jsonb_build_object(
      'action',           'pickup_completed',
      'previous_status',  OLD.status,
      'new_status',       NEW.status,
      'item_count',       _item_count,
      'has_photo',        NEW.final_photo_path IS NOT NULL,
      'has_signature',    NEW.signature_data IS NOT NULL,
      'override_active',  public._workflow_override_active()
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_pickup_completed ON public.pickup_orders;
CREATE TRIGGER trg_log_pickup_completed
AFTER UPDATE ON public.pickup_orders
FOR EACH ROW
EXECUTE FUNCTION public.log_pickup_completed();