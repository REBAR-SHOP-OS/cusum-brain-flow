
-- Create social_approvals table for approval workflow
CREATE TABLE public.social_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  feedback TEXT,
  deadline TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '4 hours'),
  decided_at TIMESTAMPTZ,
  escalation_count INTEGER NOT NULL DEFAULT 0,
  notified_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_social_approval_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid social_approval status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_social_approval_status
  BEFORE INSERT OR UPDATE ON public.social_approvals
  FOR EACH ROW EXECUTE FUNCTION public.validate_social_approval_status();

-- Enable RLS
ALTER TABLE public.social_approvals ENABLE ROW LEVEL SECURITY;

-- Approvers can see their assigned approvals
CREATE POLICY "Approvers can view their approvals"
  ON public.social_approvals FOR SELECT
  USING (auth.uid() = approver_id);

-- Post owners can see approvals for their posts
CREATE POLICY "Post owners can view approvals"
  ON public.social_approvals FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.social_posts sp WHERE sp.id = post_id AND sp.user_id = auth.uid()
  ));

-- Approvers can update (approve/reject) their approvals
CREATE POLICY "Approvers can update their approvals"
  ON public.social_approvals FOR UPDATE
  USING (auth.uid() = approver_id);

-- Authenticated users can create approvals (system creates on behalf of post owner)
CREATE POLICY "Authenticated users can create approvals"
  ON public.social_approvals FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add pending_approval to social_posts status if not already there
-- (The status column is TEXT so no enum constraint to update)

-- Index for efficient queries
CREATE INDEX idx_social_approvals_approver_status ON public.social_approvals (approver_id, status);
CREATE INDEX idx_social_approvals_post_id ON public.social_approvals (post_id);
CREATE INDEX idx_social_approvals_pending_deadline ON public.social_approvals (status, deadline) WHERE status = 'pending';
