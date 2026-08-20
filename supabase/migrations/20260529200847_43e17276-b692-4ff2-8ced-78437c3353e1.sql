CREATE OR REPLACE FUNCTION public.mirror_cut_plan_item_to_extract_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_session_id uuid;
  v_company_id uuid;
  v_row_id uuid;
  v_dims jsonb;
  v_fields text[] := ARRAY[]::text[];
BEGIN
  SELECT b.extract_session_id, b.company_id
    INTO v_session_id, v_company_id
  FROM public.cut_plans cp
  JOIN public.barlists b ON b.id = cp.barlist_id
  WHERE cp.id = NEW.cut_plan_id;

  IF v_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_row_id
  FROM public.extract_rows
  WHERE session_id = v_session_id
    AND mark = OLD.mark_number
    AND COALESCE(bar_size_mapped, bar_size) = OLD.bar_code
  LIMIT 1;

  IF v_row_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_dims := COALESCE(NEW.bend_dimensions, '{}'::jsonb);

  -- Cast each literal to text so PG doesn't resolve unknown as text[] (caused "malformed array literal" errors)
  IF NEW.mark_number     IS DISTINCT FROM OLD.mark_number     THEN v_fields := v_fields || 'mark'::text; END IF;
  IF NEW.total_pieces    IS DISTINCT FROM OLD.total_pieces    THEN v_fields := v_fields || 'quantity'::text; END IF;
  IF NEW.cut_length_mm   IS DISTINCT FROM OLD.cut_length_mm   THEN v_fields := v_fields || 'total_length_mm'::text; END IF;
  IF NEW.bar_code        IS DISTINCT FROM OLD.bar_code        THEN v_fields := v_fields || 'bar_size'::text; END IF;
  IF NEW.asa_shape_code  IS DISTINCT FROM OLD.asa_shape_code  THEN v_fields := v_fields || 'shape_code'::text; END IF;
  IF NEW.drawing_ref     IS DISTINCT FROM OLD.drawing_ref     THEN v_fields := v_fields || 'dwg'::text; END IF;
  IF NEW.bend_dimensions IS DISTINCT FROM OLD.bend_dimensions THEN v_fields := v_fields || 'dims'::text; END IF;

  UPDATE public.extract_rows
  SET
    mark              = NEW.mark_number,
    quantity          = NEW.total_pieces,
    total_length_mm   = NEW.cut_length_mm,
    bar_size_mapped   = NEW.bar_code,
    shape_code_mapped = COALESCE(NEW.asa_shape_code, shape_code_mapped),
    dwg               = COALESCE(NEW.drawing_ref, dwg),
    dim_a             = NULLIF((v_dims->>'A'),'')::numeric,
    dim_b             = NULLIF((v_dims->>'B'),'')::numeric,
    dim_c             = NULLIF((v_dims->>'C'),'')::numeric,
    dim_d             = NULLIF((v_dims->>'D'),'')::numeric,
    dim_e             = NULLIF((v_dims->>'E'),'')::numeric,
    dim_f             = NULLIF((v_dims->>'F'),'')::numeric,
    dim_g             = NULLIF((v_dims->>'G'),'')::numeric,
    dim_h             = NULLIF((v_dims->>'H'),'')::numeric,
    dim_j             = NULLIF((v_dims->>'J'),'')::numeric,
    dim_k             = NULLIF((v_dims->>'K'),'')::numeric,
    dim_o             = NULLIF((v_dims->>'O'),'')::numeric,
    dim_r             = NULLIF((v_dims->>'R'),'')::numeric,
    source_total_length_text = NULL,
    source_dims_json         = NULL
  WHERE id = v_row_id;

  IF array_length(v_fields, 1) > 0 AND v_company_id IS NOT NULL THEN
    INSERT INTO public.activity_events (
      event_type, entity_type, entity_id, actor_type, company_id, source, description, metadata
    ) VALUES (
      'extract_row_mirrored_from_cut_plan',
      'extract_row',
      v_row_id::text,
      'system',
      v_company_id,
      'system',
      'Mirrored cut_plan_item edits back to extract_row for Tags/Export parity',
      jsonb_build_object(
        'cut_plan_item_id', NEW.id,
        'extract_row_id',   v_row_id,
        'session_id',       v_session_id,
        'fields_changed',   to_jsonb(v_fields)
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mirror_cut_plan_item_to_extract_row ON public.cut_plan_items;

CREATE TRIGGER trg_mirror_cut_plan_item_to_extract_row
AFTER UPDATE ON public.cut_plan_items
FOR EACH ROW
WHEN (
  OLD.mark_number     IS DISTINCT FROM NEW.mark_number
  OR OLD.total_pieces    IS DISTINCT FROM NEW.total_pieces
  OR OLD.cut_length_mm   IS DISTINCT FROM NEW.cut_length_mm
  OR OLD.bend_dimensions IS DISTINCT FROM NEW.bend_dimensions
  OR OLD.asa_shape_code  IS DISTINCT FROM NEW.asa_shape_code
  OR OLD.bar_code        IS DISTINCT FROM NEW.bar_code
  OR OLD.drawing_ref     IS DISTINCT FROM NEW.drawing_ref
)
EXECUTE FUNCTION public.mirror_cut_plan_item_to_extract_row();
