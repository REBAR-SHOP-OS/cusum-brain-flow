
-- Trigger function: when a cut_plan_item enters 'complete', auto-create its loading_checklist row.
CREATE OR REPLACE FUNCTION public.auto_release_complete_to_loading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF NEW.phase = 'complete'
     AND (TG_OP = 'INSERT' OR OLD.phase IS DISTINCT FROM 'complete') THEN
    SELECT company_id INTO v_company_id FROM public.cut_plans WHERE id = NEW.cut_plan_id;
    IF v_company_id IS NULL THEN
      RETURN NEW;
    END IF;
    INSERT INTO public.loading_checklist (company_id, cut_plan_id, cut_plan_item_id, loaded)
    VALUES (v_company_id, NEW.cut_plan_id, NEW.id, false)
    ON CONFLICT (cut_plan_id, cut_plan_item_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_release_complete_to_loading ON public.cut_plan_items;
CREATE TRIGGER trg_auto_release_complete_to_loading
  AFTER INSERT OR UPDATE OF phase ON public.cut_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.auto_release_complete_to_loading();

-- Backfill: every cut_plan_item already at 'complete' without a loading_checklist row.
INSERT INTO public.loading_checklist (company_id, cut_plan_id, cut_plan_item_id, loaded)
SELECT cp.company_id, cpi.cut_plan_id, cpi.id, false
FROM public.cut_plan_items cpi
JOIN public.cut_plans cp ON cp.id = cpi.cut_plan_id
WHERE cpi.phase = 'complete'
  AND NOT EXISTS (
    SELECT 1 FROM public.loading_checklist lc
    WHERE lc.cut_plan_id = cpi.cut_plan_id AND lc.cut_plan_item_id = cpi.id
  );
