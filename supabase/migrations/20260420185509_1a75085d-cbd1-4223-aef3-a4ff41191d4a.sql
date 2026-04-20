-- 1. Extend allowed statuses to include 'cut_done'
CREATE OR REPLACE FUNCTION public.validate_cut_plan_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('draft', 'queued', 'running', 'cut_done', 'completed', 'canceled') THEN
    RAISE EXCEPTION 'Invalid cut_plan status: %. Allowed: draft, queued, running, cut_done, completed, canceled', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Trigger function to auto-advance cut_plans.status based on aggregate item phases
CREATE OR REPLACE FUNCTION public.auto_advance_plan_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_total int;
  v_all_complete int;
  v_all_cut_or_beyond int;
  v_has_bend int;
  v_current_status text;
  v_new_status text;
BEGIN
  v_plan_id := COALESCE(NEW.cut_plan_id, OLD.cut_plan_id);
  IF v_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE phase = 'complete'),
    COUNT(*) FILTER (WHERE phase IN ('cut_done', 'bending', 'bend_done', 'complete')),
    COUNT(*) FILTER (WHERE bend_type = 'bend')
  INTO v_total, v_all_complete, v_all_cut_or_beyond, v_has_bend
  FROM public.cut_plan_items
  WHERE cut_plan_id = v_plan_id;

  IF v_total = 0 THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_current_status FROM public.cut_plans WHERE id = v_plan_id;

  IF v_all_complete = v_total THEN
    v_new_status := 'completed';
  ELSIF v_all_cut_or_beyond = v_total THEN
    IF v_has_bend > 0 THEN
      v_new_status := 'cut_done';
    ELSE
      v_new_status := 'completed';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF v_current_status IS DISTINCT FROM v_new_status THEN
    UPDATE public.cut_plans
    SET status = v_new_status,
        updated_at = now()
    WHERE id = v_plan_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_advance_plan_status ON public.cut_plan_items;
CREATE TRIGGER trg_auto_advance_plan_status
AFTER INSERT OR UPDATE OF phase ON public.cut_plan_items
FOR EACH ROW
EXECUTE FUNCTION public.auto_advance_plan_status();

-- 3. Backfill: re-evaluate every existing plan
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT cut_plan_id FROM public.cut_plan_items WHERE cut_plan_id IS NOT NULL LOOP
    UPDATE public.cut_plan_items
    SET phase = phase
    WHERE id = (SELECT id FROM public.cut_plan_items WHERE cut_plan_id = r.cut_plan_id LIMIT 1);
  END LOOP;
END $$;