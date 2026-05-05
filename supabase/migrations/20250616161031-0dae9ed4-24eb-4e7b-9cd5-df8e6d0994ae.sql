
-- Enable RLS on workshops table if not already enabled
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view workshops" ON workshops;
DROP POLICY IF EXISTS "Authenticated users can create workshops" ON workshops; 
DROP POLICY IF EXISTS "Authenticated users can update workshops" ON workshops;
DROP POLICY IF EXISTS "Authenticated users can delete workshops" ON workshops;

-- Create comprehensive policies for workshops table
-- Allow all authenticated users to view workshops
CREATE POLICY "Authenticated users can view workshops" 
  ON workshops 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Allow authenticated users to create workshops
CREATE POLICY "Authenticated users can create workshops" 
  ON workshops 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Allow authenticated users to update workshops
CREATE POLICY "Authenticated users can update workshops" 
  ON workshops 
  FOR UPDATE 
  TO authenticated 
  USING (true);

-- Allow authenticated users to delete workshops
CREATE POLICY "Authenticated users can delete workshops" 
  ON workshops 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- Create a function to get user role safely
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.user_roles WHERE user_id = user_uuid LIMIT 1;
$$;

-- Create an admin user if it doesn't exist (you'll need to update the email)
-- Note: You'll need to manually create this user through Supabase Auth first
-- Then run this to give them admin role:
-- INSERT INTO public.user_roles (user_id, role) 
-- VALUES ('your-user-id-here', 'admin') 
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
