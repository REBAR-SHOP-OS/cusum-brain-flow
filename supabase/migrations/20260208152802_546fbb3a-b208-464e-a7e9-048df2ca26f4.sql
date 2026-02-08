-- Make integration_connections per-user
-- Step 1: Clear existing global rows (they have no user context)
DELETE FROM public.integration_connections;

-- Step 2: Add user_id column
ALTER TABLE public.integration_connections 
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL;

-- Step 3: Drop old unique constraint and add per-user one
ALTER TABLE public.integration_connections 
  DROP CONSTRAINT integration_connections_integration_id_key;

ALTER TABLE public.integration_connections 
  ADD CONSTRAINT integration_connections_user_integration_key 
  UNIQUE (user_id, integration_id);

-- Step 4: Update RLS policies for per-user access
DROP POLICY IF EXISTS "Authenticated users can read integration_connections" ON public.integration_connections;
DROP POLICY IF EXISTS "Admins can manage integration_connections" ON public.integration_connections;
DROP POLICY IF EXISTS "Service role can manage integration_connections" ON public.integration_connections;

CREATE POLICY "Users can read own connections"
  ON public.integration_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own connections"
  ON public.integration_connections FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);