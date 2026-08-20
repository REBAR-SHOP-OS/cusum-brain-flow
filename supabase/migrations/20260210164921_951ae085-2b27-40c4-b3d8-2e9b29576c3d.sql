
-- Create face_enrollments table
CREATE TABLE public.face_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.face_enrollments ENABLE ROW LEVEL SECURITY;

-- Employees can view their own enrollments
CREATE POLICY "Users can view own face enrollments"
  ON public.face_enrollments FOR SELECT
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Employees can insert their own enrollments
CREATE POLICY "Users can insert own face enrollments"
  ON public.face_enrollments FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Employees can update their own enrollments
CREATE POLICY "Users can update own face enrollments"
  ON public.face_enrollments FOR UPDATE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Employees can delete their own enrollments
CREATE POLICY "Users can delete own face enrollments"
  ON public.face_enrollments FOR DELETE
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Admins can view all enrollments (for the face-recognize function)
CREATE POLICY "Admins can view all face enrollments"
  ON public.face_enrollments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage all enrollments
CREATE POLICY "Admins can manage all face enrollments"
  ON public.face_enrollments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create private storage bucket for face enrollment photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('face-enrollments', 'face-enrollments', false);

-- Storage policies: users can upload to their own folder
CREATE POLICY "Users can upload own face photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'face-enrollments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own face photos
CREATE POLICY "Users can view own face photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'face-enrollments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own face photos
CREATE POLICY "Users can delete own face photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'face-enrollments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Service role can read all face photos (for edge function recognition)
-- This is handled by service_role key in the edge function, no policy needed

-- Admins can view all face photos for management
CREATE POLICY "Admins can view all face photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'face-enrollments'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
