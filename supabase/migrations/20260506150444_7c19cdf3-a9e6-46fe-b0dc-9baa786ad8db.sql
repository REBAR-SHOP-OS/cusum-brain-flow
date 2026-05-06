-- cut_plan_items: allow any authenticated user to UPDATE
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='cut_plan_items' AND cmd='UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.cut_plan_items', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Any authenticated user can update cut_plan_items"
ON public.cut_plan_items
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- extract_rows: allow any authenticated user to UPDATE
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='extract_rows' AND cmd='UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.extract_rows', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Any authenticated user can update extract_rows"
ON public.extract_rows
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);