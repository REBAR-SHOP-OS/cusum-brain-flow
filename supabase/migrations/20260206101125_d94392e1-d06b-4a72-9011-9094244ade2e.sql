-- Create table to store integration connection status
CREATE TABLE public.integration_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'available',
    last_checked_at timestamp with time zone,
    last_sync_at timestamp with time zone,
    error_message text,
    config jsonb DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

-- Only admin and authenticated users can read integrations
CREATE POLICY "Authenticated users can read integration_connections"
ON public.integration_connections
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify integrations
CREATE POLICY "Admins can manage integration_connections"
ON public.integration_connections
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role can manage integration_connections"
ON public.integration_connections
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_integration_connections_updated_at
BEFORE UPDATE ON public.integration_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();