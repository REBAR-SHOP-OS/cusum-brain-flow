
-- R8-3: Create atomic increment RPC for bend_completed_pieces
CREATE OR REPLACE FUNCTION public.increment_bend_completed_pieces(
  p_item_id UUID,
  p_increment INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  UPDATE cut_plan_items
  SET bend_completed_pieces = LEAST(
    COALESCE(bend_completed_pieces, 0) + p_increment,
    total_pieces
  )
  WHERE id = p_item_id
  RETURNING bend_completed_pieces INTO v_new_count;

  RETURN v_new_count;
END;
$$;
