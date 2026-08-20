
-- Helper: resolve company_id from thread_id
CREATE OR REPLACE FUNCTION public.entity_link_company_check(p_thread_id uuid)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT company_id FROM chat_threads WHERE id = p_thread_id LIMIT 1;
$$;

-- Drop old permissive policies
DROP POLICY IF EXISTS "auth_read_entity_links" ON public.entity_links;
DROP POLICY IF EXISTS "auth_insert_entity_links" ON public.entity_links;
DROP POLICY IF EXISTS "auth_delete_entity_links" ON public.entity_links;

-- SELECT: only threads in user's company
CREATE POLICY "auth_read_entity_links"
  ON public.entity_links FOR SELECT TO authenticated
  USING (entity_link_company_check(thread_id) = get_user_company_id(auth.uid()));

-- INSERT: only link to threads in user's company
CREATE POLICY "auth_insert_entity_links"
  ON public.entity_links FOR INSERT TO authenticated
  WITH CHECK (entity_link_company_check(thread_id) = get_user_company_id(auth.uid()));

-- DELETE: only delete links to threads in user's company
CREATE POLICY "auth_delete_entity_links"
  ON public.entity_links FOR DELETE TO authenticated
  USING (entity_link_company_check(thread_id) = get_user_company_id(auth.uid()));
