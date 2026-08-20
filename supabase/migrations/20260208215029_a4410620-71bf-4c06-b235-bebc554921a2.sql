
-- Add engagement/analytics columns to social_posts
ALTER TABLE public.social_posts
ADD COLUMN IF NOT EXISTS reach integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS impressions integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS comments integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS shares integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS saves integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicks integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS content_type text DEFAULT 'post',
ADD COLUMN IF NOT EXISTS page_name text;

-- Create table for strategy checklist progress
CREATE TABLE IF NOT EXISTS public.social_strategy_checklist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  checklist_item_id text NOT NULL,
  completed boolean DEFAULT true,
  completed_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, checklist_item_id)
);

ALTER TABLE public.social_strategy_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own checklist" ON public.social_strategy_checklist
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own checklist" ON public.social_strategy_checklist
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own checklist" ON public.social_strategy_checklist
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own checklist" ON public.social_strategy_checklist
  FOR DELETE USING (auth.uid() = user_id);
