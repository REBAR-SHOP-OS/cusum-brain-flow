
CREATE OR REPLACE FUNCTION public.validate_cut_plan_machine_capability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only validate when machine_id is being set/changed
  IF NEW.machine_id IS NOT NULL AND (OLD.machine_id IS DISTINCT FROM NEW.machine_id) THEN
    IF EXISTS (
      SELECT 1
      FROM public.cut_plan_items cpi
      WHERE cpi.cut_plan_id = NEW.id
        AND NOT EXISTS (
          SELECT 1
          FROM public.machine_capabilities mc
          WHERE mc.machine_id = NEW.machine_id
            AND mc.bar_code = cpi.bar_code
            AND mc.process = 'cut'
        )
    ) THEN
      RAISE EXCEPTION 'Cut plan contains items incompatible with the selected machine capabilities';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_machine_capability ON public.cut_plans;
CREATE TRIGGER trg_validate_machine_capability
  BEFORE UPDATE ON public.cut_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cut_plan_machine_capability();
