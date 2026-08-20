
-- Add health/RTSP/model fields to cameras table
ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS brand text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS model text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS uid text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS http_port integer DEFAULT 80,
  ADD COLUMN IF NOT EXISTS https_port integer DEFAULT 443,
  ADD COLUMN IF NOT EXISTS rtsp_path_secondary text DEFAULT '/h264Preview_01_main',
  ADD COLUMN IF NOT EXISTS online_offline_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS api_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS stream_status text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT NULL;
