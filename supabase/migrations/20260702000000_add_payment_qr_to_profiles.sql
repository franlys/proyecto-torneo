-- Add payment_qr_url column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_qr_url TEXT;
