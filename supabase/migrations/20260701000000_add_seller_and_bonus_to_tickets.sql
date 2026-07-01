-- Migration: Add promo codes table and tickets columns for seller & bonus tracking
-- Purpose: Support custom discount codes and reseller/affiliate rewards.

-- 1. Create promo codes table
CREATE TABLE IF NOT EXISTS public.raffle_promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_percent INT DEFAULT 0,
    raffle_id UUID REFERENCES public.raffles(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS on promo codes
ALTER TABLE public.raffle_promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cualquiera puede leer codigos activos" ON public.raffle_promo_codes;
CREATE POLICY "Cualquiera puede leer codigos activos" ON public.raffle_promo_codes 
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins tienen acceso total a codigos" ON public.raffle_promo_codes;
CREATE POLICY "Admins tienen acceso total a codigos" ON public.raffle_promo_codes 
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- 3. Add columns to tickets table
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS is_bonus BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
