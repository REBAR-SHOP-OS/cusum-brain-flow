-- Deduplicate scheduled_activities so the existing unique index migration can succeed
DELETE FROM public.scheduled_activities WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY entity_id, activity_type, summary, due_date
      ORDER BY created_at DESC, id DESC
    ) AS rn FROM public.scheduled_activities
    WHERE entity_type = 'lead'
  ) t WHERE rn > 1
);

-- Fix RLS: Allow workshop/office/field to DELETE deliveries
DROP POLICY IF EXISTS "Admin can delete deliveries" ON public.deliveries;
CREATE POLICY "Staff can delete deliveries"
ON public.deliveries
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'office') OR
  public.has_role(auth.uid(), 'field') OR
  public.has_role(auth.uid(), 'workshop')
);

-- Fix RLS: Allow workshop/office/field to DELETE delivery_stops
DROP POLICY IF EXISTS "Admin can delete delivery_stops" ON public.delivery_stops;
CREATE POLICY "Staff can delete delivery_stops"
ON public.delivery_stops
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'office') OR
  public.has_role(auth.uid(), 'field') OR
  public.has_role(auth.uid(), 'workshop')
);

-- Fix RLS: Add workshop to UPDATE policy on deliveries
DROP POLICY IF EXISTS "Office and field can update deliveries" ON public.deliveries;
CREATE POLICY "Office field workshop can update deliveries"
ON public.deliveries
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'office') OR
  public.has_role(auth.uid(), 'field') OR
  public.has_role(auth.uid(), 'workshop')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'office') OR
  public.has_role(auth.uid(), 'field') OR
  public.has_role(auth.uid(), 'workshop')
);