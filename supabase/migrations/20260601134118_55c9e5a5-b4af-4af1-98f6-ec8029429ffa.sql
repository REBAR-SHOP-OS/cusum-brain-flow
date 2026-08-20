-- Dedupe extract_rows: keep oldest (id) per (session_id, row_index)
DELETE FROM public.extract_rows er
USING (
  SELECT session_id, row_index, MIN(id::text)::uuid AS keep_id
  FROM public.extract_rows
  GROUP BY session_id, row_index
  HAVING COUNT(*) > 1
) d
WHERE er.session_id = d.session_id
  AND er.row_index = d.row_index
  AND er.id <> d.keep_id;

-- Prevent future double-inserts from retried extract-manifest calls
CREATE UNIQUE INDEX IF NOT EXISTS extract_rows_session_row_unique
  ON public.extract_rows (session_id, row_index);