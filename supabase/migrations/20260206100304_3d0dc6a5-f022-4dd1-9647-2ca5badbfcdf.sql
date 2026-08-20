-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'sales', 'accounting');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user has any of specified roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- RLS policies for user_roles table (only admins can manage roles)
CREATE POLICY "Admins can manage user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Drop existing contacts policies
DROP POLICY IF EXISTS "Authenticated users can read contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can delete contacts" ON public.contacts;

-- Create new role-based contacts policies (sales, accounting, and admin can access)
CREATE POLICY "Sales and accounting can read contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin', 'sales', 'accounting']::app_role[]));

CREATE POLICY "Sales and accounting can insert contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'sales', 'accounting']::app_role[]));

CREATE POLICY "Sales and accounting can update contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin', 'sales', 'accounting']::app_role[]));

CREATE POLICY "Sales and accounting can delete contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['admin', 'sales', 'accounting']::app_role[]));