
-- Fix: drop and recreate trigger that already exists
DROP TRIGGER IF EXISTS trg_validate_scheduled_report ON public.scheduled_reports;
CREATE TRIGGER trg_validate_scheduled_report
  BEFORE INSERT OR UPDATE ON public.scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_scheduled_report_fields();

-- Fix the RLS policy (may need recreation if company_id was text before)
DROP POLICY IF EXISTS "Users can manage their company reports" ON public.scheduled_reports;
CREATE POLICY "Users can manage their company reports"
  ON public.scheduled_reports
  FOR ALL
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));
