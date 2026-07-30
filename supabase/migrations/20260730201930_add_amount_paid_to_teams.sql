-- Add amount_paid column to track joint payments for tournament entry fees
ALTER TABLE public.teams
ADD COLUMN amount_paid numeric NOT NULL DEFAULT 0;
