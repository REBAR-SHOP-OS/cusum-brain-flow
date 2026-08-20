
-- Remove the broad SELECT policy for sales/accounting on raw contacts table
DROP POLICY IF EXISTS "Staff can read own company contacts" ON public.contacts;

-- Create a restricted SELECT policy: sales/accounting can only read contacts 
-- they are actively working with (linked to their own leads/communications)
-- For browsing, they must use the contacts_safe view which masks PII
CREATE POLICY "Sales accounting read own customer contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['sales'::app_role, 'accounting'::app_role])
  AND company_id = get_user_company_id(auth.uid())
  AND (
    -- Only allow access to contacts linked to customers they have interactions with
    customer_id IN (
      SELECT DISTINCT customer_id FROM public.communications 
      WHERE user_id = auth.uid() AND customer_id IS NOT NULL
    )
    OR
    -- Or contacts linked to their pipeline leads
    customer_id IN (
      SELECT DISTINCT customer_id FROM public.leads 
      WHERE assigned_to = auth.uid() AND customer_id IS NOT NULL
    )
    OR
    -- Or individual contact lookups from their communications
    id IN (
      SELECT DISTINCT contact_id FROM public.communications
      WHERE user_id = auth.uid() AND contact_id IS NOT NULL
    )
  )
);
