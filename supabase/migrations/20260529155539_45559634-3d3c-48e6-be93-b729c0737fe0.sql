-- D-Gate: Delivery Completion backend gate
-- Surgical, additive: BEFORE UPDATE trigger on delivery_stops enforces
-- final POD photo + customer signature + full unloading checklist before
-- status -> 'delivered'. AFTER UPDATE writes audit events. Respects
-- _workflow_override_active().

CREATE OR REPLACE FUNCTION public.validate_delivery_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _slip_item_total integer := 0;
  _checklist_total integer := 0;
  _checklist_done  integer := 0;
  _notes_json      jsonb;
BEGIN
  -- Only gate when transitioning into 'delivered'
  IF NEW.status IS DISTINCT FROM 'delivered' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF public._workflow_override_active() THEN
    RETURN NEW;
  END IF;

  -- Customer signature
  IF NEW.pod_signature IS NULL OR length(trim(NEW.pod_signature)) = 0 THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_DELIVERY_SIGNATURE_REQUIRED: customer signature is required to complete delivery'
      USING ERRCODE = 'P0001';
  END IF;

  -- Final delivery photo
  IF NEW.pod_photo_url IS NULL OR length(trim(NEW.pod_photo_url)) = 0 THEN
    RAISE EXCEPTION 'WORKFLOW_GATE_DELIVERY_PHOTO_REQUIRED: final delivery photo is required to complete delivery'
      USING ERRCODE = 'P0001';
  END IF;

  -- Item-by-item confirmation:
  -- Items live in packing_slips.items_json for this delivery; the per-stop
  -- confirmation count is persisted by the terminal as JSON in notes:
  -- { checklist_completed, checklist_total }.
  SELECT COALESCE(SUM(jsonb_array_length(
           CASE WHEN jsonb_typeof(items_json) = 'array' THEN items_json ELSE '[]'::jsonb END
         )), 0)
    INTO _slip_item_total
    FROM public.packing_slips
   WHERE delivery_id = NEW.delivery_id
     AND company_id = NEW.company_id;

  IF _slip_item_total > 0 THEN
    BEGIN
      _notes_json := NEW.notes::jsonb;
    EXCEPTION WHEN others THEN
      _notes_json := NULL;
    END;

    IF _notes_json IS NULL
       OR _notes_json->>'checklist_total' IS NULL
       OR _notes_json->>'checklist_completed' IS NULL THEN
      RAISE EXCEPTION 'WORKFLOW_GATE_DELIVERY_CHECKLIST_INCOMPLETE: unloading checklist confirmation is missing'
        USING ERRCODE = 'P0001';
    END IF;

    _checklist_total := COALESCE((_notes_json->>'checklist_total')::int, 0);
    _checklist_done  := COALESCE((_notes_json->>'checklist_completed')::int, 0);

    IF _checklist_total <= 0 OR _checklist_done < _checklist_total THEN
      RAISE EXCEPTION 'WORKFLOW_GATE_DELIVERY_CHECKLIST_INCOMPLETE: % of % unloading items confirmed', _checklist_done, _checklist_total
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_delivery_completion ON public.delivery_stops;
CREATE TRIGGER trg_validate_delivery_completion
BEFORE UPDATE ON public.delivery_stops
FOR EACH ROW
EXECUTE FUNCTION public.validate_delivery_completion();

-- Audit: log successful delivery completion
CREATE OR REPLACE FUNCTION public.log_delivery_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM 'delivered' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.activity_events (
    company_id, event_type, entity_type, entity_id, actor_id, source, description, metadata
  ) VALUES (
    NEW.company_id,
    'audit',
    'delivery_stop',
    NEW.id::text,
    auth.uid()::text,
    'workflow_gate',
    'delivery_completed',
    jsonb_build_object(
      'action',          'delivery_completed',
      'delivery_id',     NEW.delivery_id,
      'previous_status', OLD.status,
      'new_status',      NEW.status,
      'has_photo',       NEW.pod_photo_url IS NOT NULL,
      'has_signature',   NEW.pod_signature IS NOT NULL,
      'override_active', public._workflow_override_active()
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_delivery_completed ON public.delivery_stops;
CREATE TRIGGER trg_log_delivery_completed
AFTER UPDATE ON public.delivery_stops
FOR EACH ROW
EXECUTE FUNCTION public.log_delivery_completed();