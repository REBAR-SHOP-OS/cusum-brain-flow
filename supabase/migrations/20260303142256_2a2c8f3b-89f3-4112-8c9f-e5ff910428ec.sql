-- Reload PostgREST schema cache so API sees new columns
NOTIFY pgrst, 'reload schema';