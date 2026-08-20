
CREATE TABLE public.ai_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  agent_name text,
  company_id text,
  user_id uuid,
  status text NOT NULL DEFAULT 'success',
  http_status int,
  latency_ms int,
  prompt_tokens int DEFAULT 0,
  completion_tokens int DEFAULT 0,
  total_tokens int DEFAULT 0,
  execution_path text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert ai_execution_log"
  ON public.ai_execution_log FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read ai_execution_log"
  ON public.ai_execution_log FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_ai_execution_log_created_at ON public.ai_execution_log (created_at DESC);
CREATE INDEX idx_ai_execution_log_request_id ON public.ai_execution_log (request_id);
