
-- PART 1: Add manager_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- PART 1: Anti-circular manager trigger
CREATE OR REPLACE FUNCTION public.validate_no_circular_manager()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _current UUID;
  _depth INT := 0;
BEGIN
  IF NEW.manager_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.manager_id = NEW.id THEN
    RAISE EXCEPTION 'Cannot be your own manager';
  END IF;
  _current := NEW.manager_id;
  WHILE _current IS NOT NULL AND _depth < 10 LOOP
    SELECT manager_id INTO _current FROM public.profiles WHERE id = _current;
    IF _current = NEW.id THEN
      RAISE EXCEPTION 'Circular reporting chain detected';
    END IF;
    _depth := _depth + 1;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_no_circular_manager
BEFORE INSERT OR UPDATE OF manager_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_no_circular_manager();

-- PART 1: Admin-only manager_id changes
CREATE OR REPLACE FUNCTION public.protect_manager_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF OLD.manager_id IS DISTINCT FROM NEW.manager_id THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only admins can change manager assignments';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_manager_id
BEFORE UPDATE OF manager_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_manager_id();

-- PART 2a: Add columns to leave_requests
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS assigned_approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS approval_routing TEXT;

-- PART 2a: Auto-assign leave approver on INSERT
CREATE OR REPLACE FUNCTION public.assign_leave_approver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _manager_id UUID;
  _manager_name TEXT;
  _approver_id UUID;
  _routing TEXT;
  _ceo_id UUID;
  _ceo_name TEXT;
  _admin_id UUID;
  _admin_name TEXT;
BEGIN
  -- 1. Get requester's manager
  SELECT manager_id INTO _manager_id FROM public.profiles WHERE id = NEW.profile_id;

  -- 2. If manager exists and is not the requester
  IF _manager_id IS NOT NULL AND _manager_id != NEW.profile_id THEN
    SELECT full_name INTO _manager_name FROM public.profiles WHERE id = _manager_id;
    _approver_id := _manager_id;
    _routing := 'direct_manager:' || COALESCE(_manager_name, _manager_id::text);
  ELSE
    -- 3. Fallback to CEO (sattar@rebar.shop)
    SELECT id, full_name INTO _ceo_id, _ceo_name FROM public.profiles WHERE email = 'sattar@rebar.shop' LIMIT 1;
    IF _ceo_id IS NOT NULL AND _ceo_id != NEW.profile_id THEN
      _approver_id := _ceo_id;
      _routing := 'fallback_ceo:' || COALESCE(_ceo_name, 'CEO');
    ELSE
      -- 4. Fallback to any admin that is NOT the requester
      SELECT p.id, p.full_name INTO _admin_id, _admin_name
      FROM public.user_roles ur
      JOIN public.profiles p ON p.user_id = ur.user_id
      WHERE ur.role = 'admin' AND p.id != NEW.profile_id
      ORDER BY p.full_name
      LIMIT 1;
      IF _admin_id IS NOT NULL THEN
        _approver_id := _admin_id;
        _routing := 'fallback_admin:' || COALESCE(_admin_name, 'Admin');
      ELSE
        _routing := 'no_approver_found';
      END IF;
    END IF;
  END IF;

  NEW.assigned_approver_id := _approver_id;
  NEW.approval_routing := _routing;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_leave_approver
BEFORE INSERT ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.assign_leave_approver();

-- PART 2a: Block self-approval
CREATE OR REPLACE FUNCTION public.block_self_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('approved', 'denied') AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    IF NEW.reviewed_by = NEW.profile_id THEN
      RAISE EXCEPTION 'Self-approval is not allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_self_approval
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.block_self_approval();
