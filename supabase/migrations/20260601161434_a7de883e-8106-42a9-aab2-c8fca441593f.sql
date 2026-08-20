CREATE OR REPLACE FUNCTION public.log_clearance_zone_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
BEGIN
  IF NEW.storage_zone IS DISTINCT FROM COALESCE(OLD.storage_zone, NULL)
     AND NEW.storage_zone IS NOT NULL THEN
    SELECT cp.company_id INTO _company_id
      FROM public.cut_plan_items ci
      JOIN public.cut_plans cp ON cp.id = ci.cut_plan_id
     WHERE ci.id = NEW.cut_plan_item_id
     LIMIT 1;

    INSERT INTO public.activity_events (
      company_id, event_type, entity_type, entity_id, actor_id, metadata
    ) VALUES (
      _company_id,
      'audit',
      'clearance_evidence',
      NEW.id,
      auth.uid(),
      jsonb_build_object(
        'action', 'storage_zone_assigned',
        'cut_plan_item_id', NEW.cut_plan_item_id,
        'previous_zone', OLD.storage_zone,
        'new_zone', NEW.storage_zone
      )
    );
  END IF;
  RETURN NEW;
END;
$$;