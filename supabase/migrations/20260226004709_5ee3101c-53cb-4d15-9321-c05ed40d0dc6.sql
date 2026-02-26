
CREATE OR REPLACE FUNCTION public.increment_completed_pieces(
  p_item_id UUID,
  p_increment INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new INT;
BEGIN
  UPDATE cut_plan_items
  SET completed_pieces = LEAST(completed_pieces + p_increment, total_pieces)
  WHERE id = p_item_id
  RETURNING completed_pieces INTO v_new;
  RETURN v_new;
END;
$$;
