
CREATE OR REPLACE FUNCTION public.validate_machine_capability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _num int;
BEGIN
  -- Extract numeric part from bar_code (e.g. '10M' -> 10, '25M' -> 25)
  _num := regexp_replace(NEW.bar_code, '[^0-9]', '', 'g')::int;
  
  -- Cutter-01: only 10M, 15M allowed
  IF NEW.machine_id = 'e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3' AND NEW.process = 'cut' THEN
    IF _num > 15 THEN
      RAISE EXCEPTION 'Cutter-01 only supports bar sizes <= 15M, got %', NEW.bar_code;
    END IF;
  END IF;
  
  -- Cutter-02: only 20M+ allowed
  IF NEW.machine_id = 'b0000000-0000-0000-0000-000000000002' AND NEW.process = 'cut' THEN
    IF _num < 20 THEN
      RAISE EXCEPTION 'Cutter-02 only supports bar sizes >= 20M, got %', NEW.bar_code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_machine_capability ON public.machine_capabilities;
CREATE TRIGGER trg_validate_machine_capability
  BEFORE INSERT OR UPDATE ON public.machine_capabilities
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_machine_capability();
