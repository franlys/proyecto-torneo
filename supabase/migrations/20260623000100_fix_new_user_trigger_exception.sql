-- Migration: Fix new user trigger exception handler for safety
-- Project: Proyecto-Torneos

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, email)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'username',
    -- First user ever gets ADMIN automatically for ease of setup
    CASE WHEN (SELECT COUNT(*) FROM public.profiles) = 0 THEN 'ADMIN'::user_role ELSE 'STREAMER'::user_role END,
    new.email
  );
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
