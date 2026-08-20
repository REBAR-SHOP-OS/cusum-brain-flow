
-- Block self-approval on expense claims (mirrors block_self_approval on leave_requests)
CREATE OR REPLACE FUNCTION public.block_expense_self_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('approved', 'rejected')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('approved', 'rejected'))
     AND NEW.reviewed_by IS NOT NULL
     AND NEW.reviewed_by = NEW.profile_id THEN
    RAISE EXCEPTION 'You cannot approve or reject your own expense claim';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER block_expense_self_approval
BEFORE UPDATE ON public.expense_claims
FOR EACH ROW
EXECUTE FUNCTION public.block_expense_self_approval();
