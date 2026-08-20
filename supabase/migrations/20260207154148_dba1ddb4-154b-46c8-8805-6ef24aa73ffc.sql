
-- Fix overly permissive INSERT/UPDATE on suggestions — restrict to admin/office roles
DROP POLICY "System can insert suggestions" ON public.suggestions;
DROP POLICY "Users can update suggestion status" ON public.suggestions;

CREATE POLICY "Admin and office can insert suggestions"
  ON public.suggestions FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'office'::app_role])
  );

CREATE POLICY "Authenticated users can update own shown suggestions"
  ON public.suggestions FOR UPDATE TO authenticated
  USING (shown_to = auth.uid() OR shown_to IS NULL);
