-- Register Rebuild agent for system rebuild/development workflows
INSERT INTO public.agents (code, name, default_role, enabled)
VALUES ('rebuild', 'Rebuild', 'admin', true)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  default_role = EXCLUDED.default_role,
  enabled = EXCLUDED.enabled;
