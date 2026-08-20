-- Fix broken trigger: quotes has no lead_id column
CREATE OR REPLACE FUNCTION public.block_lead_delete_with_children()
RETURNS TRIGGER AS $$
BEGIN
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;