-- Rate limiting infrastructure
CREATE TABLE public.rate_limit_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  function_name TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_rate_limit_lookup 
ON public.rate_limit_entries (user_id, function_name, requested_at DESC);

-- Enable RLS (only edge functions via service role will access this)
ALTER TABLE public.rate_limit_entries ENABLE ROW LEVEL SECURITY;

-- No public policies - only service role can read/write

-- Rate limit check function (returns TRUE if allowed, FALSE if blocked)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id TEXT,
  _function_name TEXT,
  _max_requests INT DEFAULT 10,
  _window_seconds INT DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  _count INT;
  _window_start TIMESTAMPTZ;
BEGIN
  _window_start := now() - (_window_seconds || ' seconds')::interval;
  
  -- Purge old entries for this user/function (keeps table clean)
  DELETE FROM rate_limit_entries 
  WHERE user_id = _user_id 
    AND function_name = _function_name 
    AND requested_at < _window_start;
  
  -- Count recent requests in the window
  SELECT COUNT(*) INTO _count
  FROM rate_limit_entries
  WHERE user_id = _user_id
    AND function_name = _function_name
    AND requested_at >= _window_start;
  
  -- If over limit, reject
  IF _count >= _max_requests THEN
    RETURN FALSE;
  END IF;
  
  -- Record this request
  INSERT INTO rate_limit_entries (user_id, function_name)
  VALUES (_user_id, _function_name);
  
  RETURN TRUE;
END;
$$;

-- Periodic cleanup function (for old entries across all users)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_entries()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $$
  DELETE FROM rate_limit_entries WHERE requested_at < now() - interval '10 minutes';
$$;