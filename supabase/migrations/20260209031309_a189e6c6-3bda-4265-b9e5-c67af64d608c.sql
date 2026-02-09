-- Add assigned_to column to notifications (references profiles for employee assignment)
ALTER TABLE public.notifications 
ADD COLUMN assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add index for efficient lookup by assigned employee
CREATE INDEX idx_notifications_assigned_to ON public.notifications(assigned_to) WHERE assigned_to IS NOT NULL;

-- Add reminder_at column for scheduled reminders
ALTER TABLE public.notifications
ADD COLUMN reminder_at TIMESTAMPTZ;

-- Add index for reminder scheduling
CREATE INDEX idx_notifications_reminder_at ON public.notifications(reminder_at) WHERE reminder_at IS NOT NULL AND status != 'dismissed';

-- Update RLS policies to allow service role inserts (for edge functions creating notifications)
-- Drop the existing insert policy if it restricts to auth.uid() only
DO $$
BEGIN
  -- Allow users to see notifications assigned to them
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view notifications assigned to them') THEN
    CREATE POLICY "Users can view notifications assigned to them"
    ON public.notifications
    FOR SELECT
    USING (
      assigned_to IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    );
  END IF;
END $$;