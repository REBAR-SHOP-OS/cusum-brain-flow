-- Both triggers call validate_machine_capability(), which references NEW.capabilities,
-- a column that does not exist on public.machine_capabilities (current shape is
-- machine_id + process + bar_code). The triggers are dead and block all writes.
DROP TRIGGER IF EXISTS trg_validate_machine_capability ON public.machine_capabilities;
DROP TRIGGER IF EXISTS validate_machine_capability_trigger ON public.machine_capabilities;
DROP FUNCTION IF EXISTS public.validate_machine_capability();