-- Add password_hash column to profiles table for password protection
-- This allows each profile to have a password without using Supabase auth.users

-- Ensure pgcrypto extension is available
create extension if not exists "pgcrypto";

-- Add password_hash column to profiles table
alter table public.profiles
  add column if not exists password_hash text;

-- Add comment explaining the column
comment on column public.profiles.password_hash is 'Bcrypt hash of the profile password. Used for password verification without requiring email-based auth.';

-- Create index for faster lookups (though UUID primary key is already indexed)
-- Note: We don't index password_hash itself for security reasons

-- Create function to verify profile password
create or replace function public.verify_profile_password(
  profile_id uuid,
  provided_password text
)
returns boolean
language plpgsql
security definer
as $$
declare
  stored_hash text;
begin
  -- Get the stored password hash for the profile
  select password_hash into stored_hash
  from public.profiles
  where id = profile_id;

  -- If no hash exists, return false
  if stored_hash is null then
    return false;
  end if;

  -- Verify the password using crypt function
  -- crypt(provided_password, stored_hash) will use the salt from stored_hash
  -- and return the same hash if password matches
  return crypt(provided_password, stored_hash) = stored_hash;
end;
$$;

-- Grant execute permission to authenticated users (or anon if needed)
-- For now, we'll use service role, so no explicit grant needed
comment on function public.verify_profile_password is 'Verifies a password against a profile''s stored password hash using bcrypt.';

