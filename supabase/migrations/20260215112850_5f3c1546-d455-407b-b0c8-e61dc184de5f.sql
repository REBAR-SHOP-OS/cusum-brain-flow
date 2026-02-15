
-- Add AI toggle to widget configs
ALTER TABLE public.support_widget_configs
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT DEFAULT 'You are a helpful support assistant. Answer questions based on the knowledge base articles provided. If you don''t know the answer, say so and suggest the visitor wait for a human agent. Keep responses concise and friendly.';
